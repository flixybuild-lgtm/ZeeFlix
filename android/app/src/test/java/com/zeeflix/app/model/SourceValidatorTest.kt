package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SourceValidatorTest {

    @Test
    fun acceptsHttpsAndLocalMediaPaths() {
        assertTrue(SourceValidator.isSafeSource("https://video.blender.org/a.mp4"))
        assertTrue(SourceValidator.isSafeSource("https://example.com/v.mp4?q=123&x=4"))
        assertTrue(SourceValidator.isSafeSource("media/sintel.webm"))
    }

    @Test
    fun rejectsInsecureSchemesCredentialsAndTraversal() {
        assertFalse(SourceValidator.isSafeSource("http://example.com/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("javascript:alert(1)"))
        assertFalse(SourceValidator.isSafeSource("https://user:pass@example.com/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("media/../secret.txt"))
        assertFalse(SourceValidator.isSafeSource("media/"))
        assertFalse(SourceValidator.isSafeSource("https:///clip"))
        assertFalse(SourceValidator.isSafeSource("https://example.com/a.mp4\nnext"))
        assertFalse(SourceValidator.isSafeSource("https://example.com/a b.mp4"))
    }

    @Test
    fun hostsAndMediaPathsAreAsciiOnly() {
        // Mirrors the web platform: Unicode/IDN hosts are outside the allowlist.
        assertFalse(SourceValidator.isSafeSource("https://münchen.de/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("https://exämple.com/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("media/sintelä.webm"))
    }

    @Test
    fun embedUrlsMustUseAnAllowlistedPrefix() {
        assertTrue(SourceValidator.isSafeEmbed("https://www.youtube-nocookie.com/embed/LjTrYSjELxs"))
        assertTrue(SourceValidator.isSafeEmbed("https://player.vimeo.com/video/76979871"))
        assertTrue(SourceValidator.isSafeEmbed("https://video.blender.org/videos/embed/abc_123-4"))
        assertFalse(SourceValidator.isSafeEmbed("https://evil.example.com/embed/123"))
        assertFalse(SourceValidator.isSafeEmbed("https://www.youtube-nocookie.com/embed/"))
        assertFalse(SourceValidator.isSafeEmbed("https://www.youtube-nocookie.com/embed/a b"))
        assertFalse(SourceValidator.isSafeEmbed("https://www.youtube-nocookie.com/embed/abc?x=1"))
    }

    @Test
    fun providerValidationEnforcesRightsNameAndFormat() {
        assertTrue(
            SourceValidator.validateProvider("Film", "https://example.com/v.mp4", "mp4", true, false).isFailure
        )
        assertTrue(
            SourceValidator.validateProvider("   ", "https://example.com/v.mp4", "mp4", true, true).isFailure
        )
        assertTrue(
            SourceValidator.validateProvider(
                "x".repeat(91), "https://example.com/v.mp4", "mp4", true, true
            ).isFailure
        )
        assertTrue(
            SourceValidator.validateProvider("Film", "https://example.com/v.mp4", "mkv", true, true).isFailure
        )
        assertTrue(
            SourceValidator.validateProvider("Film", "https://example.com/embed/1", "embed", true, true).isFailure
        )
        assertTrue(
            SourceValidator.validateProvider("Film", "http://example.com/v.mp4", "mp4", true, true).isFailure
        )

        val ok = SourceValidator
            .validateProvider("  Film  ", "  https://example.com/v.mp4  ", "mp4", true, true)
            .getOrThrow()
        assertEquals("Film", ok.name)
        assertEquals("https://example.com/v.mp4", ok.url)
        assertTrue(ok.enabled)
        assertTrue(ok.download)
    }

    @Test
    fun downloadsAreOnlyAllowedForDirectProgressiveFormats() {
        val streams = mapOf(
            "hls" to "https://example.com/main.m3u8",
            "dash" to "https://example.com/manifest.mpd",
            "embed" to "https://www.youtube-nocookie.com/embed/LjTrYSjELxs"
        )
        for ((format, url) in streams) {
            val provider = SourceValidator.validateProvider("Stream", url, format, true, true).getOrThrow()
            assertFalse("$format must never be downloadable", provider.download)
        }
    }

    @Test
    fun supportedFormatsAreTheDocumentedFive() {
        assertEquals(listOf("mp4", "webm", "hls", "dash", "embed"), SourceValidator.SUPPORTED_FORMATS)
    }
}
