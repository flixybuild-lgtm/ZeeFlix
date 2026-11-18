package com.zeeflix.app.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FilterTest {

    private fun film(
        id: String = "x",
        title: String = "Sintel",
        genres: String = "Adventure,Fantasy,Drama",
        cast: String = "Halina Reijn,Thom Hoffman",
        year: String = "2010"
    ) = Film(
        id = id,
        title = title,
        art = "sintel",
        year = year,
        minutes = "15",
        genres = genres,
        cast = cast,
        source = "media/sintel.webm",
        episode = 0,
        description = "Dragon quest",
        format = "local",
        download = true
    )

    @Test
    fun emptyFilterMatchesEverything() {
        assertTrue(Filter().matches(film()))
    }

    @Test
    fun queryIgnoresCaseAndTrimsAcrossTitleGenreAndCast() {
        assertTrue(Filter(query = "  steel  ").matches(film(title = "Tears of Steel")))
        assertTrue(Filter(query = "SINTEL").matches(film()))
        assertTrue(Filter(query = "fantasy").matches(film()))
        assertTrue(Filter(query = "thom hoffman").matches(film()))
        assertFalse(Filter(query = "godzilla").matches(film()))
    }

    @Test
    fun filtersIntersectInsteadOfOverridingEachOther() {
        val f = film()
        assertTrue(Filter(genre = "Adventure", year = "2010").matches(f))
        assertFalse(Filter(genre = "Adventure", year = "2011").matches(f))
        assertFalse(Filter(genre = "Horror").matches(f))
        assertTrue(Filter(genre = "All").matches(f))
        assertTrue(Filter(actor = "Thom Hoffman").matches(f))
        assertFalse(Filter(actor = "Thom").matches(f))
        assertTrue(Filter(query = "sintel", genre = "Fantasy", actor = "Halina Reijn", year = "2010").matches(f))
    }
}
