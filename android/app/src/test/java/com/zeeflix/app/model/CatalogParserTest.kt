package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogParserTest {

    private fun catalog(): String {
        val stream = javaClass.classLoader?.getResourceAsStream("catalog.tsv")
            ?: error("catalog.tsv test resource is missing")
        return stream.bufferedReader().use { it.readText() }
    }

    @Test
    fun liveCatalogueParsesEveryRowWithUniqueIds() {
        val films = CatalogParser.parseTsv(catalog())
        assertEquals(11, films.size)
        assertEquals(films.size, films.map { it.id }.toSet().size)
    }

    @Test
    fun liveCatalogueMapsFormatsAndSources() {
        val films = CatalogParser.parseTsv(catalog()).associateBy { it.id }
        assertEquals("local", films.getValue("sintel").format)
        assertEquals("media/sintel.webm", films.getValue("sintel").source)
        assertEquals("embed", films.getValue("fright").format)
        assertEquals(
            "https://www.youtube-nocookie.com/embed/LjTrYSjELxs",
            films.getValue("fright").source
        )
        assertEquals("peer", films.getValue("steel").format)
        assertEquals("8533ea43-4271-4a57-9694-e9d0b35e1aa1", films.getValue("steel").source)
    }

    @Test
    fun liveCatalogueFlagsOnlyAuthorisedDownloads() {
        val films = CatalogParser.parseTsv(catalog()).associateBy { it.id }
        assertTrue(films.getValue("steel").download)
        assertTrue(films.getValue("sintel").download)
        assertFalse(films.getValue("agent").download)
        assertFalse(films.getValue("making-sintel").download)
        assertFalse(films.getValue("fright").download)
    }

    @Test
    fun spotlightIdsResolveToCatalogueEntries() {
        val films = CatalogParser.parseTsv(catalog()).associateBy { it.id }
        CatalogParser.SPOTLIGHT_IDS.forEach { id ->
            assertTrue("spotlight id $id is missing from the catalogue", films.containsKey(id))
        }
    }

    @Test
    fun malformedRowsAreSkippedWithoutBreakingTheRest() {
        val tsv = buildString {
            append("# comment line\n")
            append("\n")
            append("only\tthree\tcolumns\n")
            append("sintel\tSintel\tsintel\t2010\t15\tAdventure,Fantasy\tHalina Reijn\tlocal\t0\tDragon quest\n")
        }
        val films = CatalogParser.parseTsv(tsv)
        assertEquals(1, films.size)
        assertEquals("sintel", films[0].id)
        assertEquals(0, films[0].episode)
    }
}
