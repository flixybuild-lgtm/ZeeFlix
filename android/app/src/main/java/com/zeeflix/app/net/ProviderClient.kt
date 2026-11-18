package com.zeeflix.app.net

import android.content.Context
import com.zeeflix.app.model.Film
import com.zeeflix.app.model.PeerVariant
import com.zeeflix.app.model.PlaybackFallback
import com.zeeflix.app.model.ProbeResult
import com.zeeflix.app.model.ResolvedStream
import com.zeeflix.app.model.SourceValidator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object ProviderClient {
    private const val BLENDER_ORIGIN = "https://video.blender.org"

    suspend fun resolveFilm(film: Film): ResolvedStream = withContext(Dispatchers.IO) {
        when (film.format) {
            "local" -> ResolvedStream(
                mode = "direct",
                variants = listOf(
                    PeerVariant(
                        url = "asset:///${film.source}",
                        label = "640 × 272",
                        height = 272,
                        sizeBytes = 0L,
                        downloadUrl = ""
                    )
                )
            )
            "peer" -> resolvePeerStream(film)
            "hls", "dash", "embed" -> {
                require(SourceValidator.isSafeSource(film.source)) { "Unsafe media source." }
                ResolvedStream(mode = film.format, streamUrl = film.source)
            }
            else -> {
                require(SourceValidator.isSafeSource(film.source)) { "Unsafe media source." }
                val url = if (film.source.startsWith("media/")) "asset:///${film.source}" else film.source
                ResolvedStream(
                    mode = "direct",
                    variants = listOf(
                        PeerVariant(
                            url = url,
                            label = "Original",
                            height = 0,
                            sizeBytes = 0L,
                            downloadUrl = if (film.download && url.startsWith("https://")) url else ""
                        )
                    )
                )
            }
        }
    }

    /**
     * Resolves a PeerTube title, falling back to the bundled direct rendition when the
     * provider index is unreachable. Only a connectivity failure triggers the fallback;
     * an explicit "not published" answer from the provider is always honoured.
     */
    private fun resolvePeerStream(film: Film): ResolvedStream =
        try {
            fetchPeerStream(film.source, film.download)
        } catch (io: IOException) {
            PlaybackFallback.directStreamFor(film) ?: throw io
        }

    private fun fetchPeerStream(videoId: String, allowDownload: Boolean): ResolvedStream {
        val conn = (URL("$BLENDER_ORIGIN/api/v1/videos/$videoId").openConnection() as HttpURLConnection).apply {
            connectTimeout = 9000
            readTimeout = 9000
            requestMethod = "GET"
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("Provider returned HTTP $code")
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            val privacy = json.optJSONObject("privacy")?.optInt("id") ?: 0
            val state = json.optJSONObject("state")?.optInt("id") ?: 0
            if (privacy != 1 || json.optBoolean("blacklisted") || state != 1) {
                throw IllegalStateException("The provider has not published this title.")
            }
            val downloadAllowed = allowDownload && json.optBoolean("downloadEnabled", false)
            val files = json.optJSONArray("files")
            val variants = buildList {
                if (files != null) {
                    for (i in 0 until files.length()) {
                        val f = files.optJSONObject(i) ?: continue
                        val fileUrl = f.optString("fileUrl")
                        if (!f.optBoolean("hasVideo", true) || !f.optBoolean("hasAudio", true)) continue
                        if (!fileUrl.contains(".mp4", ignoreCase = true) || !SourceValidator.isSafeSource(fileUrl)) continue
                        val res = f.optJSONObject("resolution")
                        val height = res?.optInt("id") ?: 0
                        val label = res?.optString("label")?.takeIf { it.isNotBlank() } ?: "Original"
                        val dlUrl = f.optString("fileDownloadUrl").ifBlank { fileUrl }
                        add(
                            PeerVariant(
                                url = fileUrl,
                                label = label,
                                height = height,
                                sizeBytes = f.optLong("size", 0L),
                                downloadUrl = if (downloadAllowed && SourceValidator.isSafeSource(dlUrl)) dlUrl else ""
                            )
                        )
                    }
                }
            }.sortedBy { it.height }

            if (variants.isNotEmpty()) {
                return ResolvedStream(mode = "direct", variants = variants)
            }
            val playlists = json.optJSONArray("streamingPlaylists")
            if (playlists != null) {
                for (i in 0 until playlists.length()) {
                    val p = playlists.optJSONObject(i) ?: continue
                    val plUrl = p.optString("playlistUrl")
                    if (p.optInt("type") == 1 && SourceValidator.isSafeSource(plUrl)) {
                        return ResolvedStream(mode = "hls", streamUrl = plUrl)
                    }
                }
            }
            val embedPath = json.optString("embedPath")
            if (embedPath.startsWith("/videos/embed/")) {
                return ResolvedStream(mode = "embed", streamUrl = "$BLENDER_ORIGIN$embedPath")
            }
            throw IllegalStateException("No playable rendition is published.")
        } finally {
            conn.disconnect()
        }
    }

    suspend fun probe(context: Context, format: String, url: String): ProbeResult = withContext(Dispatchers.IO) {
        runCatching {
            when (format) {
                "local" -> {
                    context.assets.open(url).close()
                    ProbeResult("Connected · Local film verified", true)
                }
                "embed" -> ProbeResult("Embed status not exposed; open title to play", null)
                "peer" -> {
                    val resolved = fetchPeerStream(url, false)
                    val count = resolved.variants.size
                    ProbeResult(
                        if (count > 0) "Connected · $count qualities verified" else "Connected · Provider index verified",
                        true
                    )
                }
                "hls", "dash" -> {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 9000
                        readTimeout = 9000
                    }
                    try {
                        val code = conn.responseCode
                        if (code !in 200..299) throw IllegalStateException("HTTP $code")
                        val snippet = conn.inputStream.bufferedReader().use { r ->
                            val buf = CharArray(4096)
                            val n = r.read(buf)
                            if (n > 0) String(buf, 0, n) else ""
                        }
                        val valid = if (format == "hls") snippet.trimStart().startsWith("#EXTM3U") else snippet.contains("<MPD")
                        if (!valid) throw IllegalStateException("Invalid $format manifest")
                        ProbeResult("Connected · Manifest verified", true)
                    } finally {
                        conn.disconnect()
                    }
                }
                else -> {
                    if (url.startsWith("media/")) {
                        context.assets.open(url).close()
                        ProbeResult("Connected · Local file verified", true)
                    } else {
                        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                            connectTimeout = 9000
                            readTimeout = 9000
                            requestMethod = "HEAD"
                        }
                        try {
                            val code = conn.responseCode
                            if (code !in 200..399) throw IllegalStateException("HTTP $code")
                            ProbeResult("Connected · HTTP $code", true)
                        } finally {
                            conn.disconnect()
                        }
                    }
                }
            }
        }.getOrElse { e ->
            ProbeResult(e.message ?: "Unreachable provider", false)
        }
    }
}
