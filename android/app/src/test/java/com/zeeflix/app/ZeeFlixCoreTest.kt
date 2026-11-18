package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ZeeFlixCoreTest {
    @Test
    fun sourceValidatorRejectsUnsafeUrlsAndEmbeds() {
        assertTrue(SourceValidator.isSafeSource("https://video.blender.org/a.mp4"))
        assertTrue(SourceValidator.isSafeSource("media/sintel.webm"))
        assertFalse(SourceValidator.isSafeSource("http://example.com/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("javascript:alert(1)"))
        assertFalse(SourceValidator.isSafeSource("https://user:pass@example.com/a.mp4"))
        assertFalse(SourceValidator.isSafeSource("media/../secret.txt"))
        assertTrue(SourceValidator.isSafeEmbed("https://www.youtube-nocookie.com/embed/LjTrYSjELxs"))
        assertFalse(SourceValidator.isSafeEmbed("https://evil.example.com/embed/123"))
    }

    @Test
    fun providerValidationEnforcesRightsAndDownloadRules() {
        val err = SourceValidator.validateProvider("Film", "https://example.com/v.mp4", "mp4", true, false)
        assertTrue(err.isFailure)

        val hls = SourceValidator.validateProvider("HLS Stream", "https://example.com/main.m3u8", "hls", true, true).getOrThrow()
        assertFalse(hls.download)

        val mp4 = SourceValidator.validateProvider("Direct MP4", "https://example.com/v.mp4", "mp4", true, true).getOrThrow()
        assertTrue(mp4.download)
    }

    @Test
    fun resumeThresholdsAndCatalogParsingWork() {
        assertFalse(WatchProgress("sintel", 2, 100).isUnfinished())
        assertTrue(WatchProgress("sintel", 10, 100).isUnfinished())
        assertFalse(WatchProgress("sintel", 98, 100).isUnfinished())

        val row = "sintel\tSintel\tsintel\t2010\t15\tAdventure,Fantasy\tHalina Reijn\tlocal\t0\tDragon quest"
        val parsed = CatalogParser.parseTsv(row)
        assertEquals(1, parsed.size)
        assertEquals("local", parsed[0].format)
        assertTrue(Filter(query = "sintel", genre = "Adventure", year = "2010").matches(parsed[0]))
        assertFalse(Filter(year = "2022").matches(parsed[0]))
    }
}
