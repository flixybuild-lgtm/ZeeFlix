package com.zeeflix.app.model

data class Film(
    val id: String,
    val title: String,
    val art: String,
    val year: String,
    val minutes: String,
    val genres: String,
    val cast: String,
    val source: String,
    val episode: Int,
    val description: String,
    val format: String,
    val download: Boolean
) {
    fun primaryGenre(): String = genres.split(',').firstOrNull()?.takeIf { it.isNotBlank() } ?: "Independent"
    fun kind(): String = when {
        episode > 0 -> "Series"
        primaryGenre() == "Documentary" -> "Documentary"
        else -> "Film"
    }
    fun providerName(): String = when {
        format == "local" -> "ZeeFlix Library"
        id.startsWith("custom-") -> "Personal provider"
        else -> "Blender Open Movies"
    }
}

data class Provider(
    val id: String,
    val name: String,
    val url: String,
    val format: String,
    val enabled: Boolean,
    val download: Boolean
) {
    fun toFilm(): Film = Film(
        id = id,
        title = name,
        art = "personal",
        year = "",
        minutes = "",
        genres = "Independent",
        cast = "",
        source = url,
        episode = 0,
        description = "An authorized title from your personal media collection.",
        format = format,
        download = download
    )
}

data class WatchProgress(
    val id: String,
    val timeSec: Int,
    val durationSec: Int
) {
    fun isUnfinished(): Boolean =
        timeSec >= 3 &&
            timeSec + 3 < durationSec &&
            timeSec.toLong() * 100L < durationSec.toLong() * 98L
}

data class Filter(
    val query: String = "",
    val genre: String = "",
    val actor: String = "",
    val year: String = ""
) {
    fun matches(f: Film): Boolean {
        val q = query.trim().lowercase()
        val matchesQuery = q.isEmpty() ||
            f.title.lowercase().contains(q) ||
            f.genres.lowercase().contains(q) ||
            f.cast.lowercase().contains(q)
        val matchesGenre = genre.isEmpty() || genre == "All" ||
            f.genres.split(',').any { it.equals(genre, ignoreCase = true) }
        val matchesActor = actor.isEmpty() ||
            f.cast.split(',').any { it.equals(actor, ignoreCase = true) }
        val matchesYear = year.isEmpty() || f.year == year
        return matchesQuery && matchesGenre && matchesActor && matchesYear
    }
}

data class PeerVariant(
    val url: String,
    val label: String,
    val height: Int,
    val sizeBytes: Long,
    val downloadUrl: String
)

data class ResolvedStream(
    val mode: String, // "direct", "hls", "dash", "embed"
    val variants: List<PeerVariant> = emptyList(),
    val streamUrl: String = ""
)

data class ProbeResult(
    val label: String,
    val ok: Boolean?
)

data class DownloadRecord(
    val downloadId: Long,
    val filmId: String,
    val title: String,
    val quality: String,
    val url: String,
    val sizeBytes: Long
)

object SourceValidator {
    val SUPPORTED_FORMATS = listOf("mp4", "webm", "hls", "dash", "embed")

    private val EMBED_PREFIXES = listOf(
        "https://www.youtube-nocookie.com/embed/",
        "https://www.youtube.com/embed/",
        "https://player.vimeo.com/video/",
        "https://video.blender.org/videos/embed/"
    )

    fun isSafeSource(raw: String): Boolean {
        if (raw.length > 2048 || raw.any { it.isISOControl() || it.isWhitespace() || it in "<>\"'\\" }) {
            return false
        }
        if (raw.startsWith("media/")) {
            val file = raw.removePrefix("media/")
            return file.isNotEmpty() &&
                !file.contains("..") &&
                file.all { it.isLetterOrDigit() || it in "-_." }
        }
        if (!raw.startsWith("https://")) return false
        val rest = raw.removePrefix("https://")
        val host = rest.split('/', '?', '#').firstOrNull().orEmpty()
        return host.isNotEmpty() &&
            !host.contains('@') &&
            host.all { it.isLetterOrDigit() || it in "-.:[]" }
    }

    fun isSafeEmbed(raw: String): Boolean = EMBED_PREFIXES.any { prefix ->
        if (!raw.startsWith(prefix)) return@any false
        val id = raw.removePrefix(prefix)
        id.isNotEmpty() && id.all { it.isLetterOrDigit() || it in "-_" }
    }

    fun validateProvider(
        name: String,
        url: String,
        format: String,
        allowDownload: Boolean,
        rightsConfirmed: Boolean
    ): Result<Provider> {
        if (!rightsConfirmed) {
            return Result.failure(IllegalArgumentException("Confirm you have permission to stream this media."))
        }
        val cleanName = name.trim()
        val cleanUrl = url.trim()
        if (cleanName.isEmpty() || cleanName.length > 90 || cleanName.any { it.isISOControl() }) {
            return Result.failure(IllegalArgumentException("Use a title of 1–90 characters."))
        }
        if (!isSafeSource(cleanUrl)) {
            return Result.failure(IllegalArgumentException("Use a direct HTTPS URL without credentials, or a file under media/."))
        }
        if (format !in SUPPORTED_FORMATS) {
            return Result.failure(IllegalArgumentException("Choose a supported format."))
        }
        if (format == "embed" && !isSafeEmbed(cleanUrl)) {
            return Result.failure(IllegalArgumentException("Use an official YouTube, Vimeo, or Blender embed URL."))
        }
        return Result.success(
            Provider(
                id = "",
                name = cleanName,
                url = cleanUrl,
                format = format,
                enabled = true,
                download = allowDownload && (format == "mp4" || format == "webm")
            )
        )
    }
}

object CatalogParser {
    val GENRES = listOf(
        "Action", "Adventure", "Sci-Fi", "Fantasy",
        "Comedy", "Horror", "Romance", "Documentary", "Drama"
    )
    val SPOTLIGHT_IDS = listOf("steel", "sintel", "spring", "cosmos")

    fun parseTsv(tsv: String): List<Film> {
        return tsv.lineSequence()
            .filter { it.isNotBlank() && !it.startsWith("#") }
            .mapNotNull { line ->
                val v = line.split('\t')
                if (v.size != 10) return@mapNotNull null
                val (format, source) = when {
                    v[7] == "local" -> "local" to "media/sintel.webm"
                    v[7].startsWith("web:") -> {
                        val id = v[7].removePrefix("web:")
                        "embed" to "https://www.youtube-nocookie.com/embed/$id"
                    }
                    else -> "peer" to v[7]
                }
                Film(
                    id = v[0],
                    title = v[1],
                    art = v[2],
                    year = v[3],
                    minutes = v[4],
                    genres = v[5],
                    cast = v[6],
                    source = source,
                    episode = v[8].toIntOrNull() ?: 0,
                    description = v[9],
                    format = format,
                    download = format != "embed" && v[0] != "making-sintel" && v[0] != "agent"
                )
            }
            .toList()
    }
}
