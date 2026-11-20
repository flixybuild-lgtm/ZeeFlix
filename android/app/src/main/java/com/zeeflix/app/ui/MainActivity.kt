package com.zeeflix.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.zeeflix.app.R
import com.zeeflix.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        applyLiquidTheme()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.topBar.applyTopSystemBarInsets()

        if (savedInstanceState == null) {
            switchFragment(HomeFragment())
        }

        binding.bottomNav.setOnItemSelectedListener { item ->
            val frag: Fragment = when (item.itemId) {
                R.id.nav_home -> HomeFragment()
                R.id.nav_browse -> BrowseFragment()
                R.id.nav_search -> SearchFragment()
                R.id.nav_providers -> ProvidersFragment()
                R.id.nav_library -> LibraryFragment()
                else -> HomeFragment()
            }
            switchFragment(frag)
            true
        }

    }

    private fun switchFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }
}
