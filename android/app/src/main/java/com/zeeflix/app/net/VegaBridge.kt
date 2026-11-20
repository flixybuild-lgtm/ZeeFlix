package com.zeeflix.app.net

import com.zeeflix.app.model.SourceValidator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URI
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/** Data-only integration for the Vega Streams add-on. No extension code runs on Android. */
internal object VegaBridge {
    private const val FILE = "/manifest.json"
    private val movie = Regex("tt[0-9]{5,12}")
    private val episode = Regex("tt[0-9]{5,12}:[1-9][0-9]{0,3}:[1-9][0-9]{0,3}")

    private fun https(raw: String): URI? {
        if (!raw.startsWith("https://") || !SourceValidator.isSafeSource(raw)) return null
        val uri = runCatching { URI(raw) }.getOrNull() ?: return null
        return uri.takeIf { !it.host.isNullOrEmpty() && it.userInfo == null }
    }

    fun manifestUrl(raw: String): String {
        val url = https(raw.trim())
        require(url != null && url.rawPath.endsWith(FILE) && url.rawQuery == null && url.rawFragment == null &&
            url.host.lowercase() !in setOf("github.com", "api.github.com", "raw.githubusercontent.com")) {
            "Enter the HTTPS manifest.json URL of your running Vega bridge, not a GitHub repository."
        }
        return url.toASCIIString()
    }

    fun streamUrl(manifest: String, rawId: String): String {
        val id = rawId.trim()
        val type = when {
            movie.matches(id) -> "movie"
            episode.matches(id) -> "series"
            else -> throw IllegalArgumentException("Use an IMDb ID like tt1234567 or tt1234567:1:2.")
        }
        return "${manifestUrl(manifest).removeSuffix(FILE)}/stream/$type/$id.json"
    }

    suspend fun connect(raw: String): String = withContext(Dispatchers.IO) {
        val url = manifestUrl(raw)
        val data = readJson(url)
        val resources = data.optJSONArray("resources")
        val types = data.optJSONArray("types")
        fun supports(type: String) = types != null && (0 until types.length()).any { types.optString(it) == type }
        val stream = resources != null && (0 until resources.length()).any {
            resources.optString(it) == "stream" || resources.optJSONObject(it)?.optString("name") == "stream"
        }
        require(data.optString("id") == "community.vega.stremio" && stream && supports("movie") && supports("series")) {
            "This endpoint is not a compatible Vega Streams bridge."
        }
        url
    }

    data class Stream(val name: String, val detail: String, val url: String)

    internal fun isAdultMarked(name: String, detail: String, explicitFlag: Boolean): Boolean =
        explicitFlag || Regex("(?:^|[^a-z0-9])(?:18\\s*\\+|adult|mature)(?:$|[^a-z0-9])", RegexOption.IGNORE_CASE)
            .containsMatchIn("$name $detail")

    suspend fun streams(manifest: String, id: String, allowAdult: Boolean = false): List<Stream> = withContext(Dispatchers.IO) {
        val data = readJson(streamUrl(manifest, id), readMillis = 60000)
        val list = data.optJSONArray("streams") ?: throw IOException("The bridge did not return a stream list.")
        val seen = hashSetOf<String>()
        buildList {
            for (i in 0 until minOf(list.length(), 250)) {
                val item = list.optJSONObject(i) ?: continue
                val url = https(item.optString("url")) ?: continue
                if (url.path.contains("/embed/") || item.optJSONObject("drm") != null) continue
                val hints = item.optJSONObject("behaviorHints")
                if (hints?.optBoolean("notWebReady") == true ||
                    (hints?.optJSONObject("proxyHeaders")?.optJSONObject("request")?.length() ?: 0) > 0) continue
                val name = clean(item.optString("name"), 60).ifBlank { "Vega stream" }
                val detail = clean(item.optString("description").ifBlank { item.optString("title") }, 180)
                if (!allowAdult && isAdultMarked(name, detail, item.optBoolean("adult") || hints?.optBoolean("adult") == true)) continue
                val target = url.toASCIIString()
                if (!seen.add(target)) continue
                add(Stream(name, detail, target))
                if (size == 30) break
            }
        }
    }

    private fun clean(text: String, max: Int) = text.map { if (it.isISOControl()) ' ' else it }.joinToString("").trim().take(max)

    private fun readJson(url: String, readMillis: Int = 12000): JSONObject {
        val conn = URL(url).openConnection() as HttpsURLConnection
        try {
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 10000
            conn.readTimeout = readMillis
            conn.useCaches = false
            conn.setRequestProperty("Accept", "application/json")
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("Endpoint returned HTTP $code.")
            val output = ByteArrayOutputStream()
            conn.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > 512_000) throw IOException("Endpoint response is too large.")
                    output.write(buffer, 0, count)
                }
            }
            return try { JSONObject(output.toString(Charsets.UTF_8.name())) }
            catch (_: org.json.JSONException) { throw IOException("The endpoint did not return valid JSON.") }
        } catch (_: java.net.SocketTimeoutException) {
            throw IOException("The bridge timed out. Check that it is online.")
        } catch (_: java.net.UnknownHostException) {
            throw IOException("Could not reach the bridge. Check the hostname.")
        } finally { conn.disconnect() }
    }
}
