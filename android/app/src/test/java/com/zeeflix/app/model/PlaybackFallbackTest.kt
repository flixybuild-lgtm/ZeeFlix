package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackFallbackTest {

    private fun peerFilm(id: String) = Film(
        id = id,
        title = "Tears of Steel",
        art = "steel",
        year = "2012",
        minutes = "12",
        genres = "Sci-Fi,Action,Romance",
        cast = "Derek de Lint",
        source = "8533ea43-4271-4a57-9694-e9d0b35e1aa1",
        episode = 0,
        description = "desc",
        format = "peer",
        download = true
    )

    @Test
    fun spotlightTitleFallsBackToADirectRendition() {
        val stream = PlaybackFallback.directStreamFor(peerFilm("steel"))
        assertNotNull("expected a fallback stream for the spotlight title", stream)
        assertEquals("direct", stream!!.mode)
        assertEquals(1, stream.variants.size)
        assertEquals(480, stream.variants[0].height)
        assertTrue(SourceValidator.isSafeSource(stream.variants[0].url))
    }

    @Test
    fun otherTitlesHaveNoFallback() {
        assertNull(PlaybackFallback.directStreamFor(peerFilm("sintel")))
        assertNull(PlaybackFallback.directStreamFor(peerFilm("charge")))
    }
}
