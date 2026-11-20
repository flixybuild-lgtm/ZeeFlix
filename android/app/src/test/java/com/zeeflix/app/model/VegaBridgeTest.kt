package com.zeeflix.app.model

import com.zeeflix.app.net.VegaBridge
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class VegaBridgeTest {
    @Test fun resolvesMovieAndSeriesEndpointsUnderConfiguredPath() {
        val manifest = "https://bridge.example/config/manifest.json"
        assertEquals("https://bridge.example/config/stream/movie/tt1234567.json", VegaBridge.streamUrl(manifest, "tt1234567"))
        assertEquals("https://bridge.example/config/stream/series/tt1234567:1:2.json", VegaBridge.streamUrl(manifest, " tt1234567:1:2 "))
    }

    @Test fun explicitlyMarkedAdultResultsAreRecognized() {
        assertEquals(true, VegaBridge.isAdultMarked("18+ source", "", false))
        assertEquals(true, VegaBridge.isAdultMarked("Source", "mature content", false))
        assertEquals(true, VegaBridge.isAdultMarked("Source", "", true))
        assertEquals(false, VegaBridge.isAdultMarked("Family film", "1080p", false))
    }

    @Test fun rejectsUnsafeManifestUrlsAndNonEpisodeIds() {
        val invalid = listOf("http://bridge.example/manifest.json", "https://user@bridge.example/manifest.json",
            "https://bridge.example/manifest.json?token=1", "https://github.com/Zenda-Cross/vega-providers")
        for (url in invalid) {
            try { VegaBridge.manifestUrl(url); fail("Accepted an invalid manifest") }
            catch (_: IllegalArgumentException) { }
        }
        try { VegaBridge.streamUrl("https://bridge.example/manifest.json", "tt1234567:1"); fail("Accepted a season ID") }
        catch (_: IllegalArgumentException) { }
    }
}
