package com.zeeflix.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import com.zeeflix.app.model.CatalogParser
import com.zeeflix.app.model.DownloadRecord
import com.zeeflix.app.model.Film
import com.zeeflix.app.model.Filter
import com.zeeflix.app.model.Provider
import com.zeeflix.app.model.WatchProgress
import org.json.JSONArray
import org.json.JSONObject

class LibraryStore private constructor(context: Context) {
    private val appCtx = context.applicationContext
    private val prefs = appCtx.getSharedPreferences("zeeflix_state_v1", Context.MODE_PRIVATE)
    private val builtInFilms: List<Film> = loadCatalog()

    private val bitmapCache = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
    }

    var localEnabled: Boolean
        get() = prefs.getBoolean("local_enabled", true)
        set(value) = prefs.edit().putBoolean("local_enabled", value).apply()

    var blenderEnabled: Boolean
        get() = prefs.getBoolean("blender_enabled", true)
        set(value) = prefs.edit().putBoolean("blender_enabled", value).apply()

    var splashEnabled: Boolean
        get() = prefs.getBoolean("splash_enabled", true)
        set(value) = prefs.edit().putBoolean("splash_enabled", value).apply()

    var autoplayEnabled: Boolean
        get() = prefs.getBoolean("autoplay_enabled", true)
        set(value) = prefs.edit().putBoolean("autoplay_enabled", value).apply()

    var themeName: String
        get() = prefs.getString("theme_name", "cinema") ?: "cinema"
        set(value) = prefs.edit().putString("theme_name", if (value in setOf("midnight", "light", "matrix")) value else "cinema").apply()

    var vegaBridge: String
        get() = prefs.getString("vega_bridge_v1", "").orEmpty()
        set(value) {
            prefs.edit().apply { if (value.isBlank()) remove("vega_bridge_v1") else putString("vega_bridge_v1", value) }.apply()
        }

    private fun loadCatalog(): List<Film> = runCatching {
        appCtx.assets.open("catalog.tsv").bufferedReader().use {
            CatalogParser.parseTsv(it.readText())
        }
    }.getOrDefault(emptyList())

    fun loadArt(name: String): Bitmap? {
        bitmapCache.get(name)?.let { return it }
        val bmp = runCatching {
            appCtx.assets.open("art/$name.webp").use { BitmapFactory.decodeStream(it) }
        }.getOrNull() ?: return null
        bitmapCache.put(name, bmp)
        return bmp
    }

    fun getProviders(): List<Provider> {
        val raw = prefs.getString("providers_json", "[]") ?: "[]"
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                add(
                    Provider(
                        id = obj.optString("id"),
                        name = obj.optString("name"),
                        url = obj.optString("url"),
                        format = obj.optString("format"),
                        enabled = obj.optBoolean("enabled", true),
                        download = obj.optBoolean("download", false)
                    )
                )
            }
        }
    }

    private fun saveProviders(list: List<Provider>) {
        val arr = JSONArray()
        list.take(100).forEach { p ->
            arr.put(
                JSONObject()
                    .put("id", p.id)
                    .put("name", p.name)
                    .put("url", p.url)
                    .put("format", p.format)
                    .put("enabled", p.enabled)
                    .put("download", p.download)
            )
        }
        prefs.edit().putString("providers_json", arr.toString()).apply()
    }

    fun saveProvider(provider: Provider, existingId: String = ""): Result<Provider> {
        val list = getProviders().toMutableList()
        if (existingId.isBlank()) {
            if (list.size >= 100) {
                return Result.failure(IllegalStateException("The local limit is 100 providers."))
            }
            var n = 1
            while (isKnownId("custom-$n")) n++
            val created = provider.copy(id = "custom-$n")
            list.add(created)
            saveProviders(list)
            return Result.success(created)
        }
        val idx = list.indexOfFirst { it.id == existingId }
        if (idx < 0) return Result.failure(IllegalStateException("Provider not found."))
        val updated = provider.copy(id = existingId, enabled = list[idx].enabled)
        list[idx] = updated
        saveProviders(list)
        return Result.success(updated)
    }

    fun toggleProvider(id: String) {
        when (id) {
            "local" -> localEnabled = !localEnabled
            "blender" -> blenderEnabled = !blenderEnabled
            else -> {
                val list = getProviders().map {
                    if (it.id == id) it.copy(enabled = !it.enabled) else it
                }
                saveProviders(list)
            }
        }
    }

    fun deleteProvider(id: String) {
        saveProviders(getProviders().filterNot { it.id == id })
        setInList(id, false)
        setFavorite(id, false)
        saveHistory(getHistory().filterNot { it.id == id })
    }

    private fun isKnownId(id: String): Boolean =
        builtInFilms.any { it.id == id } || getProviders().any { it.id == id }

    fun titles(): List<Film> {
        val built = builtInFilms.filter {
            if (it.format == "local") localEnabled else blenderEnabled
        }
        val custom = getProviders().filter { it.enabled }.map { it.toFilm() }
        return built + custom
    }

    fun find(id: String): Film? = titles().firstOrNull { it.id == id }

    fun search(filter: Filter): List<Film> = titles().filter { filter.matches(it) }

    fun collection(name: String): List<Film> {
        val all = titles()
        return when (name) {
            "popular-movies" -> {
                val priority = listOf("steel", "bunny", "sintel", "spring", "agent", "fright", "charge")
                all.filter { it.episode == 0 }
                    .sortedBy { film -> priority.indexOf(film.id).let { if (it == -1) 99 else it } }
            }
            "popular-series" -> all.filter { it.episode > 0 }
            "recently-added" -> all.reversed()
            else -> all
        }
    }

    fun getListIds(): Set<String> = prefs.getStringSet("my_list", emptySet()).orEmpty()
    fun getFavoriteIds(): Set<String> = prefs.getStringSet("favorites", emptySet()).orEmpty()

    fun toggleList(id: String): Boolean {
        val next = !getListIds().contains(id)
        setInList(id, next)
        return next
    }

    private fun setInList(id: String, on: Boolean) {
        val s = getListIds().toMutableSet()
        if (on) s.add(id) else s.remove(id)
        prefs.edit().putStringSet("my_list", s).apply()
    }

    fun toggleFavorite(id: String): Boolean {
        val next = !getFavoriteIds().contains(id)
        setFavorite(id, next)
        return next
    }

    private fun setFavorite(id: String, on: Boolean) {
        val s = getFavoriteIds().toMutableSet()
        if (on) s.add(id) else s.remove(id)
        prefs.edit().putStringSet("favorites", s).apply()
    }

    fun getHistory(): List<WatchProgress> {
        val raw = prefs.getString("history_json", "[]") ?: "[]"
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(WatchProgress(o.optString("id"), o.optInt("time"), o.optInt("duration")))
            }
        }
    }

    private fun saveHistory(items: List<WatchProgress>) {
        val arr = JSONArray()
        items.take(256).forEach {
            arr.put(JSONObject().put("id", it.id).put("time", it.timeSec).put("duration", it.durationSec))
        }
        prefs.edit().putString("history_json", arr.toString()).apply()
    }

    fun recordProgress(id: String, timeSec: Int, durationSec: Int) {
        if (!isKnownId(id) || durationSec <= 0 || timeSec <= 0) return
        val clamped = timeSec.coerceAtMost(durationSec)
        val updated = listOf(WatchProgress(id, clamped, durationSec)) +
            getHistory().filterNot { it.id == id }
        saveHistory(updated)
    }

    fun resumeSeconds(id: String): Int =
        getHistory().firstOrNull { it.id == id && it.isUnfinished() }?.timeSec ?: 0

    fun historyFilms(unfinishedOnly: Boolean): List<Film> =
        getHistory()
            .filter { !unfinishedOnly || it.isUnfinished() }
            .mapNotNull { find(it.id) }

    fun clearHistory() {
        saveHistory(emptyList())
    }

    fun getDownloads(): List<DownloadRecord> {
        val raw = prefs.getString("downloads_json", "[]") ?: "[]"
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                add(
                    DownloadRecord(
                        downloadId = o.optLong("downloadId"),
                        filmId = o.optString("filmId"),
                        title = o.optString("title"),
                        quality = o.optString("quality"),
                        url = o.optString("url"),
                        sizeBytes = o.optLong("sizeBytes")
                    )
                )
            }
        }
    }

    fun addDownload(record: DownloadRecord) {
        val list = listOf(record) + getDownloads().filterNot { it.downloadId == record.downloadId }
        val arr = JSONArray()
        list.take(50).forEach { d ->
            arr.put(
                JSONObject()
                    .put("downloadId", d.downloadId)
                    .put("filmId", d.filmId)
                    .put("title", d.title)
                    .put("quality", d.quality)
                    .put("url", d.url)
                    .put("sizeBytes", d.sizeBytes)
            )
        }
        prefs.edit().putString("downloads_json", arr.toString()).apply()
    }

    companion object {
        @Volatile
        private var instance: LibraryStore? = null

        fun get(context: Context): LibraryStore =
            instance ?: synchronized(this) {
                instance ?: LibraryStore(context).also { instance = it }
            }
    }
}
