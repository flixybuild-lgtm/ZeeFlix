package com.zeeflix.app.ui

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.materialswitch.MaterialSwitch
import com.zeeflix.app.BuildConfig
import com.zeeflix.app.R
import com.zeeflix.app.data.LibraryStore
import com.zeeflix.app.databinding.FragmentBrowseBinding
import com.zeeflix.app.databinding.FragmentHomeBinding
import com.zeeflix.app.databinding.FragmentLibraryBinding
import com.zeeflix.app.databinding.FragmentProvidersBinding
import com.zeeflix.app.databinding.FragmentSearchBinding
import com.zeeflix.app.model.CatalogParser
import com.zeeflix.app.model.Film
import com.zeeflix.app.model.Filter
import com.zeeflix.app.model.Provider
import com.zeeflix.app.model.SourceValidator
import com.zeeflix.app.net.ProviderClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun openDetail(ctx: Context, film: Film) {
    ctx.startActivity(Intent(ctx, DetailActivity::class.java).putExtra("film_id", film.id))
}

private fun openPlayer(ctx: Context, film: Film) {
    ctx.startActivity(Intent(ctx, PlayerActivity::class.java).putExtra("film_id", film.id))
}

class HomeFragment : Fragment() {
    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private var slideIndex = 0
    private var selectedGenre = "All"

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val genres = listOf("All", "Action", "Adventure", "Sci-Fi", "Comedy", "Horror", "Romance", "Documentary")
        genres.forEach { g ->
            val chip = Chip(requireContext()).apply {
                text = when (g) {
                    "All" -> "All Genres"
                    "Documentary" -> "Documentaries"
                    else -> g
                }
                isCheckable = true
                isChecked = g == selectedGenre
                setOnClickListener {
                    selectedGenre = g
                    renderShelves()
                }
            }
            binding.homeGenreChips.addView(chip)
        }
        binding.btnHeroNext.setOnClickListener {
            slideIndex++
            renderHero()
        }
    }

    override fun onResume() {
        super.onResume()
        renderHero()
        renderShelves()
    }

    private fun renderHero() {
        val store = LibraryStore.get(requireContext())
        val spotlight = CatalogParser.SPOTLIGHT_IDS.mapNotNull { store.find(it) }
        if (spotlight.isEmpty()) {
            binding.heroTitle.text = "Library Standby"
            binding.heroMeta.text = "Enable a provider in Providers tab"
            binding.heroSynopsis.text = ""
            binding.btnHeroWatch.isEnabled = false
            binding.btnHeroList.isEnabled = false
            return
        }
        binding.btnHeroWatch.isEnabled = true
        binding.btnHeroList.isEnabled = true
        val film = spotlight[slideIndex % spotlight.size]
        binding.heroTitle.text = film.title
        binding.heroMeta.text = "${film.year} · ${film.minutes} min · ${film.primaryGenre()}"
        binding.heroSynopsis.text = film.description
        val artName = when (film.id) {
            "steel" -> "steel-wide"
            "sintel" -> "sintel-wide"
            "spring" -> "spring-wide"
            "cosmos" -> "cosmos-wide"
            else -> film.art
        }
        binding.heroImage.setImageBitmap(store.loadArt(artName) ?: store.loadArt(film.art))
        binding.btnHeroWatch.setOnClickListener { openPlayer(requireContext(), film) }

        fun syncHeroList() {
            val saved = store.getListIds().contains(film.id)
            binding.btnHeroList.text = if (saved) "In My List" else "My List"
        }
        syncHeroList()
        binding.btnHeroList.setOnClickListener {
            val added = store.toggleList(film.id)
            syncHeroList()
            Toast.makeText(requireContext(), if (added) "Added to My List" else "Removed from My List", Toast.LENGTH_SHORT).show()
        }
    }

    private fun renderShelves() {
        val store = LibraryStore.get(requireContext())
        binding.shelvesContainer.removeAllViews()
        val shelves = if (selectedGenre != "All") {
            val items = store.search(Filter(genre = selectedGenre))
            listOf(ShelfModel("GENRE COLLECTION", selectedGenre, items))
        } else {
            listOf(
                ShelfModel("PICK UP WHERE YOU LEFT OFF", "Continue Watching", store.historyFilms(true)),
                ShelfModel("THE HOT LIST", "Trending Now", store.collection("trending-now")),
                ShelfModel("THE SCREENING ROOM", "Popular Movies", store.collection("popular-movies")),
                ShelfModel("IN EPISODES", "Popular Series", store.collection("popular-series")),
                ShelfModel("NEW TO THE LIBRARY", "Recently Added", store.collection("recently-added")),
                ShelfModel("HIGH-OCTANE", "Action", store.search(Filter(genre = "Action"))),
                ShelfModel("EXPEDITIONS", "Adventure", store.search(Filter(genre = "Adventure"))),
                ShelfModel("FUTURES & WORLDS", "Science Fiction", store.search(Filter(genre = "Sci-Fi"))),
                ShelfModel("AFTER DARK", "Horror", store.search(Filter(genre = "Horror"))),
                ShelfModel("LIGHTER MOMENTS", "Comedy", store.search(Filter(genre = "Comedy"))),
                ShelfModel("HEARTS & STORIES", "Romance", store.search(Filter(genre = "Romance"))),
                ShelfModel("BEHIND THE LENS", "Documentaries", store.search(Filter(genre = "Documentary")))
            ).filter { it.items.isNotEmpty() }
        }

        val recycler = RecyclerView(requireContext()).apply {
            layoutManager = LinearLayoutManager(requireContext())
            isNestedScrollingEnabled = false
            adapter = ShelfAdapter(store, viewLifecycleOwner.lifecycleScope) { film ->
                openDetail(requireContext(), film)
            }.apply { submit(shelves) }
        }
        binding.shelvesContainer.addView(recycler)
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}

class BrowseFragment : Fragment() {
    private var _binding: FragmentBrowseBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: PosterAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentBrowseBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val store = LibraryStore.get(requireContext())
        adapter = PosterAdapter(store, viewLifecycleOwner.lifecycleScope, matchGridWidth = true) { film ->
            openDetail(requireContext(), film)
        }
        binding.browseRecycler.layoutManager = GridLayoutManager(requireContext(), 3)
        binding.browseRecycler.adapter = adapter

        binding.chipMovies.setOnClickListener { adapter.submit(store.collection("popular-movies")) }
        binding.chipShows.setOnClickListener { adapter.submit(store.collection("popular-series")) }
        binding.chipCategories.setOnClickListener {
            val genres = CatalogParser.GENRES
            AlertDialog.Builder(requireContext())
                .setTitle("Select Genre")
                .setItems(genres.toTypedArray()) { _, idx ->
                    adapter.submit(store.search(Filter(genre = genres[idx])))
                }
                .show()
        }
        adapter.submit(store.collection("popular-movies"))
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}

class SearchFragment : Fragment() {
    private var _binding: FragmentSearchBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: PosterAdapter
    private var selectedGenre = ""
    private var selectedYear = ""
    private var selectedActor = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSearchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val store = LibraryStore.get(requireContext())
        adapter = PosterAdapter(store, viewLifecycleOwner.lifecycleScope, matchGridWidth = true) { film ->
            openDetail(requireContext(), film)
        }
        binding.searchRecycler.layoutManager = GridLayoutManager(requireContext(), 3)
        binding.searchRecycler.adapter = adapter

        val genres = listOf("All genres") + CatalogParser.GENRES
        val years = listOf("All years") + store.titles().mapNotNull { it.year.takeIf { y -> y.isNotBlank() } }.distinct().sortedDescending()
        val actors = listOf("All actors") + store.titles().flatMap { it.cast.split(',') }.filter { it.isNotBlank() }.distinct().sorted()

        fun bindSpinner(sp: Spinner, items: List<String>, onPick: (String) -> Unit) {
            sp.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, items)
            sp.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p0: AdapterView<*>?, p1: View?, pos: Int, p3: Long) {
                    onPick(if (pos == 0) "" else items[pos])
                    runFilter()
                }
                override fun onNothingSelected(p0: AdapterView<*>?) {}
            }
        }

        bindSpinner(binding.spinnerGenre, genres) { selectedGenre = it }
        bindSpinner(binding.spinnerYear, years) { selectedYear = it }
        bindSpinner(binding.spinnerActor, actors) { selectedActor = it }

        binding.searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = runFilter()
            override fun afterTextChanged(s: Editable?) {}
        })
        runFilter()
    }

    private fun runFilter() {
        val b = _binding ?: return
        val res = LibraryStore.get(requireContext()).search(
            Filter(
                query = b.searchInput.text?.toString().orEmpty(),
                genre = selectedGenre,
                actor = selectedActor,
                year = selectedYear
            )
        )
        b.searchCount.text = "${res.size} titles"
        adapter.submit(res)
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}

class ProvidersFragment : Fragment() {
    private var _binding: FragmentProvidersBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: ProviderAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProvidersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val store = LibraryStore.get(requireContext())
        adapter = ProviderAdapter(
            onToggle = { row ->
                store.toggleProvider(row.id)
                refresh()
            },
            onTest = { row ->
                viewLifecycleOwner.lifecycleScope.launch {
                    val result = ProviderClient.probe(requireContext(), row.format, row.url)
                    adapter.setProbe(row.id, result)
                }
            },
            onWatch = { row ->
                store.find(row.id)?.let { openPlayer(requireContext(), it) }
            },
            onEdit = { row ->
                val existing = store.getProviders().firstOrNull { it.id == row.id }
                openProviderDialog(existing)
            },
            onDelete = { row ->
                AlertDialog.Builder(requireContext())
                    .setTitle("Remove provider?")
                    .setMessage("Remove ${row.name} and its saved watch progress?")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Remove") { _, _ ->
                        store.deleteProvider(row.id)
                        refresh()
                    }
                    .show()
            }
        )
        binding.providersRecycler.layoutManager = LinearLayoutManager(requireContext())
        binding.providersRecycler.adapter = adapter
        binding.btnAddProvider.setOnClickListener { openAddDialog() }
        refresh()
    }

    fun openAddDialog() {
        openProviderDialog(null)
    }

    private fun openProviderDialog(existing: Provider?) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_add_provider, null)
        val nameInput = dialogView.findViewById<EditText>(R.id.inputProviderName)
        val formatSpinner = dialogView.findViewById<Spinner>(R.id.spinnerProviderFormat)
        val urlInput = dialogView.findViewById<EditText>(R.id.inputProviderUrl)
        val dlCheck = dialogView.findViewById<CheckBox>(R.id.checkProviderDownload)
        val rightsCheck = dialogView.findViewById<CheckBox>(R.id.checkProviderRights)
        val errText = dialogView.findViewById<TextView>(R.id.textProviderError)

        val formats = SourceValidator.SUPPORTED_FORMATS
        formatSpinner.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, formats.map { it.uppercase() })
        if (existing != null) {
            nameInput.setText(existing.name)
            urlInput.setText(existing.url)
            dlCheck.isChecked = existing.download
            formatSpinner.setSelection(formats.indexOf(existing.format).coerceAtLeast(0))
        }

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle(if (existing == null) "Add Media Provider" else "Edit Provider")
            .setView(dialogView)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save & Watch", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val validated = SourceValidator.validateProvider(
                    name = nameInput.text.toString(),
                    url = urlInput.text.toString(),
                    format = formats[formatSpinner.selectedItemPosition],
                    allowDownload = dlCheck.isChecked,
                    rightsConfirmed = rightsCheck.isChecked
                )
                validated.onFailure {
                    errText.text = it.message
                }.onSuccess { provider ->
                    val saved = LibraryStore.get(requireContext()).saveProvider(provider, existing?.id.orEmpty())
                    saved.onFailure { errText.text = it.message }
                        .onSuccess { created ->
                            dialog.dismiss()
                            refresh()
                            openPlayer(requireContext(), created.toFilm())
                        }
                }
            }
        }
        dialog.show()
    }

    private fun refresh() {
        val store = LibraryStore.get(requireContext())
        val rows = buildList {
            add(ProviderRow("local", "ZeeFlix Library (Bundled Sintel)", "local", "media/sintel.webm", store.localEnabled, false))
            add(ProviderRow("blender", "Blender Open Movies", "peer", "8533ea43-4271-4a57-9694-e9d0b35e1aa1", store.blenderEnabled, false))
            store.getProviders().forEach {
                add(ProviderRow(it.id, it.name, it.format, it.url, it.enabled, true))
            }
        }
        adapter.submit(rows)
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}

class LibraryFragment : Fragment() {
    private var _binding: FragmentLibraryBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentLibraryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.tabMyList.setOnClickListener { showGrid(LibraryStore.get(requireContext()).let { s -> s.titles().filter { s.getListIds().contains(it.id) } }, "Your My List is empty.") }
        binding.tabFavorites.setOnClickListener { showGrid(LibraryStore.get(requireContext()).let { s -> s.titles().filter { s.getFavoriteIds().contains(it.id) } }, "No favorites yet.") }
        binding.tabContinue.setOnClickListener { showGrid(LibraryStore.get(requireContext()).historyFilms(true), "You're all caught up.") }
        binding.tabHistory.setOnClickListener { showGrid(LibraryStore.get(requireContext()).historyFilms(false), "No playback history yet.", showClear = true) }
        binding.tabDownloads.setOnClickListener { showDownloads() }
        binding.tabSettings.setOnClickListener { showSettings() }
        binding.tabAbout.setOnClickListener { showAbout() }
        binding.tabMyList.performClick()
    }

    private fun showGrid(films: List<Film>, emptyMsg: String, showClear: Boolean = false) {
        val container = binding.libraryBody
        container.removeAllViews()
        val store = LibraryStore.get(requireContext())
        val wrap = LinearLayout(requireContext()).apply { orientation = LinearLayout.VERTICAL }
        if (showClear && films.isNotEmpty()) {
            wrap.addView(
                MaterialButton(requireContext()).apply {
                    text = "Clear Playback History"
                    setOnClickListener {
                        store.clearHistory()
                        showGrid(emptyList(), emptyMsg, false)
                    }
                }
            )
        }
        if (films.isEmpty()) {
            wrap.addView(
                TextView(requireContext()).apply {
                    text = emptyMsg
                    setTextColor(ContextCompat.getColor(requireContext(), R.color.zf_muted))
                    setPadding(8, 32, 8, 8)
                }
            )
        } else {
            val rv = RecyclerView(requireContext()).apply {
                layoutManager = GridLayoutManager(requireContext(), 3)
                adapter = PosterAdapter(store, viewLifecycleOwner.lifecycleScope, matchGridWidth = true) {
                    openDetail(requireContext(), it)
                }.apply { submit(films) }
            }
            wrap.addView(rv, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
        }
        container.addView(wrap)
    }

    private fun showDownloads() {
        val container = binding.libraryBody
        container.removeAllViews()
        val store = LibraryStore.get(requireContext())
        val dm = requireContext().getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val list = LinearLayout(requireContext()).apply { orientation = LinearLayout.VERTICAL; setPadding(4, 8, 4, 8) }
        val records = store.getDownloads()
        if (records.isEmpty()) {
            list.addView(
                TextView(requireContext()).apply {
                    text = "No downloads yet. Open an authorized film and tap Download in the player."
                    setTextColor(ContextCompat.getColor(requireContext(), R.color.zf_muted))
                }
            )
        } else {
            records.forEach { rec ->
                var statusLabel = "Queued"
                val q = DownloadManager.Query().setFilterById(rec.downloadId)
                dm.query(q)?.use { c ->
                    if (c.moveToFirst()) {
                        val st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                        val soFar = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                        val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                        statusLabel = when (st) {
                            DownloadManager.STATUS_SUCCESSFUL -> "Saved"
                            DownloadManager.STATUS_FAILED -> "Failed (error ${c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))})"
                            DownloadManager.STATUS_PAUSED -> "Paused"
                            DownloadManager.STATUS_RUNNING -> if (total > 0) "${soFar * 100 / total}%" else "Downloading"
                            else -> "Pending"
                        }
                    }
                }
                val card = TextView(requireContext()).apply {
                    text = "${rec.title} (${rec.quality}) · $statusLabel"
                    setBackgroundResource(R.drawable.bg_glass_card)
                    setTextColor(ContextCompat.getColor(requireContext(), R.color.zf_text))
                    setPadding(24, 24, 24, 24)
                }
                list.addView(card, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 16 })
            }
        }
        container.addView(list)
    }

    private fun showSettings() {
        val container = binding.libraryBody
        container.removeAllViews()
        val store = LibraryStore.get(requireContext())
        val layout = LinearLayout(requireContext()).apply { orientation = LinearLayout.VERTICAL; setPadding(6, 8, 6, 8) }

        fun addToggle(title: String, initial: Boolean, onChange: (Boolean) -> Unit) {
            layout.addView(
                MaterialSwitch(requireContext()).apply {
                    text = title
                    isChecked = initial
                    setTextColor(ContextCompat.getColor(requireContext(), R.color.zf_text))
                    setOnCheckedChangeListener { _, checked -> onChange(checked) }
                }
            )
        }
        addToggle("Show opening splash animation", store.splashEnabled) { store.splashEnabled = it }
        addToggle("Auto-play next episode", store.autoplayEnabled) { store.autoplayEnabled = it }
        addToggle("Midnight Blue theme (off = Cinema Gold)", store.themeName == "midnight") { midnight ->
            store.themeName = if (midnight) "midnight" else "cinema"
            (activity as? MainActivity)?.applyThemeColors()
        }
        layout.addView(
            MaterialButton(requireContext()).apply {
                text = "Clear Playback History"
                setOnClickListener {
                    store.clearHistory()
                    Toast.makeText(requireContext(), "Playback history cleared", Toast.LENGTH_SHORT).show()
                }
            }
        )
        container.addView(layout)
    }

    private fun showAbout() {
        val container = binding.libraryBody
        container.removeAllViews()
        val scroll = android.widget.ScrollView(requireContext())
        val text = TextView(requireContext()).apply {
            setBackgroundResource(R.drawable.bg_glass_card)
            setPadding(32, 32, 32, 32)
            setTextColor(ContextCompat.getColor(requireContext(), R.color.zf_text))
            setLineSpacing(8f, 1.15f)
            text = """
                About ZeeFlix
                Entertainment Without Limits.

                ${getString(R.string.about_paragraph_1)}

                ${getString(R.string.about_paragraph_2)}

                Creator: Zeeshan Haider
                Class: 9th Class
                School: Government High School No. 1
                Teacher: Waqas Ashraf

                Technology: Version ${BuildConfig.VERSION_NAME} · Native Android (Kotlin + Media3 ExoPlayer) paired with the ZeeFlix Rust/WebAssembly platform.
                Privacy: No ZeeFlix accounts, analytics, or tracking cookies. Lists, providers, and watch history stay on this device.
                Contact: https://github.com/flixybuild-lgtm/ZeeFlix
            """.trimIndent()
            setOnClickListener {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/flixybuild-lgtm/ZeeFlix")))
            }
        }
        scroll.addView(text)
        container.addView(scroll)
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
