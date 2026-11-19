package com.zeeflix.app.ui

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.util.AttributeSet
import android.view.View
import androidx.annotation.AttrRes
import androidx.annotation.StyleRes
import com.zeeflix.app.R
import com.zeeflix.app.data.LibraryStore
import kotlin.random.Random

internal enum class LiquidTheme(val key: String, val label: String, @StyleRes val style: Int) {
    DARK("cinema", "Dark", R.style.Theme_ZeeFlix),
    LIGHT("light", "Light", R.style.Theme_ZeeFlix_Light),
    MATRIX("matrix", "Matrix", R.style.Theme_ZeeFlix_Matrix),
    MIDNIGHT("midnight", "Midnight blue", R.style.Theme_ZeeFlix_Midnight);

    companion object {
        fun current(context: Context) = entries.firstOrNull { it.key == LibraryStore.get(context).themeName } ?: DARK
    }
}

internal fun Activity.applyLiquidTheme() = setTheme(LiquidTheme.current(this).style)

internal fun Context.themeColor(@AttrRes attr: Int): Int {
    val colors = obtainStyledAttributes(intArrayOf(attr))
    return try { colors.getColor(0, 0) } finally { colors.recycle() }
}

/** Decorative and non-interactive; drawing stops as soon as the window is hidden. */
class LiquidParticlesView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private data class Dot(val x: Float, val y: Float, val speed: Float, val radius: Float, val alpha: Int)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = context.themeColor(R.attr.zfAccent) }
    private val start = SystemClock.uptimeMillis()
    private val density = resources.displayMetrics.density
    private val dots = with(Random(41)) {
        List(36) { Dot(nextFloat(), nextFloat(), 0.008f + nextFloat() * 0.018f, 0.6f + nextFloat() * 1.3f, nextInt(40, 113)) }
    }
    private var motion = false

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (visibility != VISIBLE) return
        motion = if (Build.VERSION.SDK_INT >= 26) ValueAnimator.areAnimatorsEnabled() else
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val seconds = if (motion) (SystemClock.uptimeMillis() - start) / 1000f else 0f
        for (dot in dots) {
            paint.alpha = dot.alpha
            canvas.drawCircle(((dot.x + dot.speed * seconds * 0.15f) % 1f) * width,
                ((dot.y + dot.speed * seconds) % 1f) * height, dot.radius * density, paint)
        }
        if (motion && isShown && windowVisibility == VISIBLE) postInvalidateDelayed(33)
    }
}
