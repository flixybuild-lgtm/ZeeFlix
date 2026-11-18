package com.zeeflix.app.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class WatchProgressTest {

    @Test
    fun unfinishedThresholds() {
        val cases = listOf(
            Triple(0, 20, false),
            Triple(2, 20, false),
            Triple(3, 20, true),
            Triple(16, 20, true),
            Triple(17, 20, false),
            Triple(990, 1000, false)
        )
        for ((time, duration, expected) in cases) {
            assertEquals(
                "time=$time duration=$duration",
                expected,
                WatchProgress("x", time, duration).isUnfinished()
            )
        }
    }

    @Test
    fun degenerateDurationsAreNeverUnfinished() {
        assertFalse(WatchProgress("x", 5, 0).isUnfinished())
        assertFalse(WatchProgress("x", 0, 100).isUnfinished())
        assertFalse(WatchProgress("x", 100, 100).isUnfinished())
    }
}
