package com.zeeflix.app.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.zeeflix.app.data.LibraryStore
import com.zeeflix.app.databinding.ActivityDetailBinding

class DetailActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val filmId = intent.getStringExtra("film_id").orEmpty()
        val store = LibraryStore.get(this)
        val film = store.find(filmId)
        if (film == null) {
            Toast.makeText(this, "Title unavailable", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        binding.btnDetailBack.setOnClickListener { finish() }
        binding.detailTitle.text = film.title
        val metaParts = listOfNotNull(
            film.year.takeIf { it.isNotBlank() },
            film.minutes.takeIf { it.isNotBlank() }?.let { "$it min" },
            film.genres.replace(',', '·'),
            film.providerName()
        )
        binding.detailMeta.text = metaParts.joinToString(" · ")
        binding.detailDescription.text = film.description
        binding.detailArt.setImageBitmap(store.loadArt(film.art))

        val resume = store.resumeSeconds(film.id)
        binding.btnDetailWatch.text = if (resume > 0) "Resume" else "Watch Now"
        binding.btnDetailWatch.setOnClickListener {
            startActivity(Intent(this, PlayerActivity::class.java).putExtra("film_id", film.id))
        }

        fun syncButtons() {
            binding.btnDetailList.text = if (store.getListIds().contains(film.id)) "In My List" else "My List"
            binding.btnDetailFav.text = if (store.getFavoriteIds().contains(film.id)) "Favorited" else "Fav"
        }
        syncButtons()
        binding.btnDetailList.setOnClickListener {
            store.toggleList(film.id)
            syncButtons()
        }
        binding.btnDetailFav.setOnClickListener {
            store.toggleFavorite(film.id)
            syncButtons()
        }

        val facts = buildString {
            if (film.year.isNotBlank()) append("Release: ${film.year}\n")
            if (film.minutes.isNotBlank()) append("Runtime: ${film.minutes} min\n")
            if (film.genres.isNotBlank()) append("Genres: ${film.genres.replace(",", ", ")}\n")
            if (film.cast.isNotBlank()) append("Cast: ${film.cast.replace(",", ", ")}\n")
            append("Provider: ${film.providerName()}")
        }
        binding.detailFacts.text = facts

        if (film.episode > 0) {
            store.collection("popular-series").forEach { ep ->
                binding.detailEpisodesContainer.addView(
                    MaterialButton(this).apply {
                        text = "E0${ep.episode} · ${ep.title} (${ep.minutes} min)"
                        setOnClickListener {
                            startActivity(Intent(this@DetailActivity, PlayerActivity::class.java).putExtra("film_id", ep.id))
                        }
                    }
                )
            }
        }
    }
}
