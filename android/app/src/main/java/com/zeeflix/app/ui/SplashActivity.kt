package com.zeeflix.app.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.zeeflix.app.data.LibraryStore
import com.zeeflix.app.databinding.ActivitySplashBinding

class SplashActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var launched = false

    private val goHomeRunnable = Runnable { openMain() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = LibraryStore.get(this)
        if (!store.splashEnabled) {
            openMain()
            return
        }
        val binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.root.applySystemBarInsets()
        binding.btnSkipSplash.setOnClickListener { openMain() }
        handler.postDelayed(goHomeRunnable, 1450L)
    }

    private fun openMain() {
        if (launched) return
        launched = true
        handler.removeCallbacks(goHomeRunnable)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    override fun onDestroy() {
        handler.removeCallbacks(goHomeRunnable)
        super.onDestroy()
    }
}
