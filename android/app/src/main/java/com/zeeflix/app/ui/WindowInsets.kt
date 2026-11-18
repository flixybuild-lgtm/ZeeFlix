package com.zeeflix.app.ui

import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * The app targets SDK 35, which draws edge-to-edge on Android 15 and newer: the window is
 * no longer inset for the status and navigation bars, so every surface that carries
 * controls has to opt in explicitly. Material's BottomNavigationView already applies the
 * navigation-bar inset itself; these helpers cover the remaining chrome.
 *
 * A view only ever holds one insets listener, so pick the helper that matches the edges
 * the view occupies instead of stacking calls on the same view. Padding is written from
 * the captured XML values on every dispatch so repeated inset changes never accumulate.
 */
fun View.applyTopSystemBarInsets() {
    val baseLeft = paddingLeft
    val baseTop = paddingTop
    val baseRight = paddingRight
    val baseBottom = paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
        val bars = insets.getInsets(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        )
        view.setPadding(baseLeft + bars.left, baseTop + bars.top, baseRight + bars.right, baseBottom)
        insets
    }
    ViewCompat.requestApplyInsets(this)
}

fun View.applyBottomSystemBarInsets() {
    val baseLeft = paddingLeft
    val baseTop = paddingTop
    val baseRight = paddingRight
    val baseBottom = paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
        view.setPadding(baseLeft, baseTop, baseRight, baseBottom + bars.bottom)
        insets
    }
    ViewCompat.requestApplyInsets(this)
}

fun View.applySystemBarInsets() {
    val baseLeft = paddingLeft
    val baseTop = paddingTop
    val baseRight = paddingRight
    val baseBottom = paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
        val bars = insets.getInsets(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        )
        view.setPadding(
            baseLeft + bars.left,
            baseTop + bars.top,
            baseRight + bars.right,
            baseBottom + bars.bottom
        )
        insets
    }
    ViewCompat.requestApplyInsets(this)
}
