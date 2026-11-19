package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FilmTest {

    private fun film(
        id: String = "sintel",
        genres: String = "Adventure,Fantasy,Drama",
        format: String = "local",
        episode: Int = 0
    ) = Film(
        id = id,
        title = "Sintel",
        art = "sintel",
        year = "2010",
        minutes = "15",
        genres = genres,
        cast = "Halina Reijn,Thom Hoffman",
        source = "media/sintel.webm",
        episode = episode,
        description = "Dragon quest",
        format = format,
        download = true
    )

    @Test
    fun kindFollowsEpisodeThenGenreThenFilm() {
        assertEquals("Series", film(episode = 2).kind())
        assertEquals("Documentary", film(genres = "Documentary").kind())
        assertEquals("Film", film().kind())
    }

    @Test
    fun primaryGenreFallsBackWhenBlank() {
        assertEquals("Independent", film(genres = "").primaryGenre())
        assertEquals("Adventure", film(genres = "Adventure,Fantasy").primaryGenre())
    }

    @Test
    fun providerNameReflectsTheSource() {
        assertEquals("Framewave Library", film(format = "local").providerName())
        assertEquals("Personal provider", film(id = "custom-1", format = "mp4").providerName())
        assertEquals("Blender Open Movies", film(format = "peer").providerName())
    }

    @Test
    fun providerMapsToAPersonalFilm() {
        val provider = Provider(
            id = "custom-1",
            name = "My Movie",
            url = "https://example.com/v.mp4",
            format = "mp4",
            enabled = true,
            download = true
        )
        val f = provider.toFilm()
        assertEquals("custom-1", f.id)
        assertEquals("My Movie", f.title)
        assertEquals("personal", f.art)
        assertEquals("Independent", f.genres)
        assertEquals("https://example.com/v.mp4", f.source)
        assertEquals("mp4", f.format)
        assertEquals(0, f.episode)
        assertTrue(f.download)
    }
}
