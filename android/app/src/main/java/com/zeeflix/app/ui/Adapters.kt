package com.zeeflix.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.materialswitch.MaterialSwitch
import com.zeeflix.app.R
import com.zeeflix.app.data.LibraryStore
import com.zeeflix.app.model.Film
import com.zeeflix.app.model.ProbeResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PosterAdapter(
    private val store: LibraryStore,
    private val scope: CoroutineScope,
    private val matchGridWidth: Boolean = false,
    private val onClick: (Film) -> Unit
) : RecyclerView.Adapter<PosterAdapter.VH>() {

    private var items: List<Film> = emptyList()

    fun submit(list: List<Film>) {
        items = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_poster, parent, false)
        if (matchGridWidth) {
            val lp = view.layoutParams
            lp.width = ViewGroup.LayoutParams.MATCH_PARENT
            view.layoutParams = lp
        }
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val film = items[position]
        holder.name.text = film.title
        holder.overlayTitle.text = film.title
        val yearText = if (film.year.isBlank()) "Personal" else film.year
        holder.meta.text = "$yearText · ${film.primaryGenre()}"

        val progress = store.getHistory().firstOrNull { it.id == film.id && it.isUnfinished() }
        if (progress != null && progress.durationSec > 0) {
            holder.progress.visibility = View.VISIBLE
            holder.progress.max = 100
            holder.progress.progress = (progress.timeSec * 100 / progress.durationSec).coerceIn(1, 99)
        } else {
            holder.progress.visibility = View.GONE
        }

        holder.image.setImageDrawable(null)
        holder.image.tag = film.art
        scope.launch(Dispatchers.IO) {
            val bmp = store.loadArt(film.art)
            withContext(Dispatchers.Main) {
                if (holder.image.tag == film.art && bmp != null) {
                    holder.image.setImageBitmap(bmp)
                }
            }
        }
        holder.itemView.setOnClickListener { onClick(film) }
    }

    override fun getItemCount(): Int = items.size

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val image: ImageView = v.findViewById(R.id.posterImage)
        val overlayTitle: TextView = v.findViewById(R.id.posterOverlayTitle)
        val name: TextView = v.findViewById(R.id.posterName)
        val meta: TextView = v.findViewById(R.id.posterMeta)
        val progress: ProgressBar = v.findViewById(R.id.posterProgress)
    }
}

data class ShelfModel(
    val kicker: String,
    val title: String,
    val items: List<Film>
)

class ShelfAdapter(
    private val store: LibraryStore,
    private val scope: CoroutineScope,
    private val onFilmClick: (Film) -> Unit
) : RecyclerView.Adapter<ShelfAdapter.VH>() {

    private var shelves: List<ShelfModel> = emptyList()

    fun submit(list: List<ShelfModel>) {
        shelves = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_shelf, parent, false)
        return VH(v, store, scope, onFilmClick)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val shelf = shelves[position]
        holder.kicker.text = shelf.kicker
        holder.title.text = shelf.title
        holder.adapter.submit(shelf.items)
    }

    override fun getItemCount(): Int = shelves.size

    class VH(
        v: View,
        store: LibraryStore,
        scope: CoroutineScope,
        onFilmClick: (Film) -> Unit
    ) : RecyclerView.ViewHolder(v) {
        val kicker: TextView = v.findViewById(R.id.shelfKicker)
        val title: TextView = v.findViewById(R.id.shelfTitle)
        val recycler: RecyclerView = v.findViewById(R.id.shelfRecycler)
        val adapter = PosterAdapter(store, scope, matchGridWidth = false, onClick = onFilmClick)

        init {
            recycler.layoutManager = LinearLayoutManager(v.context, LinearLayoutManager.HORIZONTAL, false)
            recycler.adapter = adapter
        }
    }
}

data class ProviderRow(
    val id: String,
    val name: String,
    val format: String,
    val url: String,
    val enabled: Boolean,
    val custom: Boolean
)

class ProviderAdapter(
    private val onToggle: (ProviderRow) -> Unit,
    private val onTest: (ProviderRow) -> Unit,
    private val onWatch: (ProviderRow) -> Unit,
    private val onEdit: (ProviderRow) -> Unit,
    private val onDelete: (ProviderRow) -> Unit
) : RecyclerView.Adapter<ProviderAdapter.VH>() {

    private var rows: List<ProviderRow> = emptyList()
    private val probes = mutableMapOf<String, ProbeResult>()

    fun submit(list: List<ProviderRow>) {
        rows = list
        notifyDataSetChanged()
    }

    fun setProbe(id: String, result: ProbeResult) {
        probes[id] = result
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_provider, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val row = rows[position]
        holder.name.text = row.name
        val kindLabel = if (row.custom) row.format.uppercase() else "Built-in"
        val probe = probes[row.id]
        val statusText = when {
            !row.enabled -> "$kindLabel · Disabled"
            probe != null -> "$kindLabel · ${probe.label}"
            else -> "$kindLabel · Ready"
        }
        holder.status.text = statusText
        val colorRes = when {
            !row.enabled || probe?.ok == null -> R.color.zf_muted
            probe.ok == true -> R.color.zf_ok
            else -> R.color.zf_bad
        }
        holder.status.setTextColor(ContextCompat.getColor(holder.itemView.context, colorRes))

        holder.toggle.setOnCheckedChangeListener(null)
        holder.toggle.isChecked = row.enabled
        holder.toggle.setOnCheckedChangeListener { _, _ -> onToggle(row) }

        holder.btnTest.isEnabled = row.enabled
        holder.btnTest.setOnClickListener {
            holder.status.text = "$kindLabel · Testing…"
            onTest(row)
        }

        if (row.custom && row.enabled) {
            holder.btnWatch.visibility = View.VISIBLE
            holder.btnWatch.setOnClickListener { onWatch(row) }
        } else {
            holder.btnWatch.visibility = View.GONE
        }

        if (row.custom) {
            holder.btnEdit.visibility = View.VISIBLE
            holder.btnDelete.visibility = View.VISIBLE
            holder.btnEdit.setOnClickListener { onEdit(row) }
            holder.btnDelete.setOnClickListener { onDelete(row) }
        } else {
            holder.btnEdit.visibility = View.GONE
            holder.btnDelete.visibility = View.GONE
        }
    }

    override fun getItemCount(): Int = rows.size

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val name: TextView = v.findViewById(R.id.providerName)
        val status: TextView = v.findViewById(R.id.providerStatus)
        val toggle: MaterialSwitch = v.findViewById(R.id.providerSwitch)
        val btnWatch: MaterialButton = v.findViewById(R.id.btnProviderWatch)
        val btnTest: MaterialButton = v.findViewById(R.id.btnProviderTest)
        val btnEdit: MaterialButton = v.findViewById(R.id.btnProviderEdit)
        val btnDelete: MaterialButton = v.findViewById(R.id.btnProviderDelete)
    }
}
