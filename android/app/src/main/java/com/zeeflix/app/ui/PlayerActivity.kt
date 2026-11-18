package com.zeeflix.app.ui

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Rational
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.annotation.OptIn
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.zeeflix.app.data.LibraryStore
import com.zeeflix.app.databinding.ActivityPlayerBinding
import com.zeeflix.app.model.DownloadRecord
import com.zeeflix.app.model.Film
import com.zeeflix.app.model.PeerVariant
import com.zeeflix.app.model.SourceValidator
import com.zeeflix.app.net.ProviderClient
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
class PlayerActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPlayerBinding
    private var player: ExoPlayer? = null
    private lateinit var trackSelector: DefaultTrackSelector
    private lateinit var store: LibraryStore
    private lateinit var film: Film
    private var variants: List<PeerVariant> = emptyList()
    private var variantIndex = 0
    private var isLandscapeLocked = false
    private var speedIndex = 2
    private var embedMode = false
    private val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        store = LibraryStore.get(this)
        val id = intent.getStringExtra("film_id").orEmpty()
        val found = store.find(id)
        if (found == null) {
            Toast.makeText(this, "Title unavailable", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        film = found
        binding.playerTitle.text = film.title
        binding.btnPlayerBack.setOnClickListener { finish() }

        setupEpisodes()
        setupControls()
        setupGestures()
        setupSystemBarInsets()
        loadMedia()
    }

    /**
     * targetSdk 35 draws edge-to-edge on Android 15+, so the video stage keeps the full
     * screen while the overlays are pushed clear of the status and navigation bars.
     */
    private fun setupSystemBarInsets() {
        binding.playerTopOverlay.applyTopSystemBarInsets()
        binding.playerOptionsBar.applyBottomSystemBarInsets()
    }

    private fun setupEpisodes() {
        val prevId = if (film.id == "llamigos") "gran-dillama" else ""
        val nextId = if (film.id == "gran-dillama") "llamigos" else ""
        if (prevId.isNotEmpty()) {
            binding.btnPrevEpisode.visibility = View.VISIBLE
            binding.btnPrevEpisode.setOnClickListener { switchEpisode(prevId) }
        }
        if (nextId.isNotEmpty()) {
            binding.btnNextEpisode.visibility = View.VISIBLE
            binding.btnNextEpisode.setOnClickListener { switchEpisode(nextId) }
        }
    }

    private fun switchEpisode(targetId: String) {
        saveProgress()
        startActivity(Intent(this, PlayerActivity::class.java).putExtra("film_id", targetId))
        finish()
    }

    private fun setupControls() {
        binding.btnFullscreen.setOnClickListener {
            isLandscapeLocked = !isLandscapeLocked
            requestedOrientation = if (isLandscapeLocked) {
                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            } else {
                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }

        binding.btnPip.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                enterPictureInPictureMode(params)
            } else {
                Toast.makeText(this, "Picture-in-Picture requires Android 8+", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnSpeed.setOnClickListener {
            speedIndex = (speedIndex + 1) % speeds.size
            val s = speeds[speedIndex]
            binding.btnSpeed.text = "${s}×"
            player?.setPlaybackParameters(PlaybackParameters(s))
        }

        binding.btnQuality.setOnClickListener { showQualityPicker() }
        binding.btnSubtitles.setOnClickListener { showTrackPicker(C.TRACK_TYPE_TEXT, "Subtitles") }
        binding.btnAudioTrack.setOnClickListener { showTrackPicker(C.TRACK_TYPE_AUDIO, "Audio Tracks") }
        binding.btnDownloadMovie.setOnClickListener { startAuthorizedDownload() }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupGestures() {
        val detector = GestureDetector(
            this,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    val p = player ?: return false
                    val width = binding.playerView.width.takeIf { it > 0 } ?: return false
                    val forward = e.x >= width / 2f
                    val delta = if (forward) 10_000L else -10_000L
                    p.seekTo((p.currentPosition + delta).coerceAtLeast(0L))
                    Toast.makeText(
                        this@PlayerActivity,
                        if (forward) "+10s" else "-10s",
                        Toast.LENGTH_SHORT
                    ).show()
                    return true
                }
            }
        )
        binding.playerView.setOnTouchListener { _, event ->
            detector.onTouchEvent(event)
            false
        }
    }

    private fun loadMedia() {
        lifecycleScope.launch {
            runCatching { ProviderClient.resolveFilm(film) }
                .onFailure { err ->
                    binding.playerStatus.text = err.message ?: "Provider unreachable"
                }
                .onSuccess { stream ->
                    if (stream.mode == "embed") {
                        mountEmbed(stream.streamUrl)
                        return@onSuccess
                    }
                    trackSelector = DefaultTrackSelector(this@PlayerActivity)
                    val exo = ExoPlayer.Builder(this@PlayerActivity)
                        .setTrackSelector(trackSelector)
                        .build()
                    player = exo
                    binding.playerView.player = exo
                    exo.addListener(object : Player.Listener {
                        override fun onPlaybackStateChanged(state: Int) {
                            when (state) {
                                Player.STATE_READY -> binding.playerStatus.visibility = View.GONE
                                Player.STATE_BUFFERING -> {
                                    binding.playerStatus.visibility = View.VISIBLE
                                    binding.playerStatus.text = "Buffering…"
                                }
                                Player.STATE_ENDED -> {
                                    saveProgress()
                                    if (film.id == "gran-dillama" && store.autoplayEnabled) {
                                        switchEpisode("llamigos")
                                    }
                                }
                                else -> {}
                            }
                        }

                        override fun onTracksChanged(tracks: Tracks) {
                            val hasAudio = tracks.groups.any { it.type == C.TRACK_TYPE_AUDIO && it.length > 1 }
                            binding.btnAudioTrack.visibility = if (hasAudio) View.VISIBLE else View.GONE
                        }

                        override fun onPlayerError(error: PlaybackException) {
                            binding.playerStatus.visibility = View.VISIBLE
                            binding.playerStatus.text = "Playback error: ${error.errorCodeName}"
                        }
                    })

                    if (stream.mode == "direct") {
                        variants = stream.variants
                        val idx = variants.indexOfFirst { it.height >= 720 }.let { if (it >= 0) it else 0 }
                        playDirectVariant(idx, store.resumeSeconds(film.id) * 1000L)
                    } else {
                        playUri(stream.streamUrl, store.resumeSeconds(film.id) * 1000L)
                    }
                }
        }
    }

    private fun playDirectVariant(index: Int, seekMs: Long) {
        variantIndex = index
        val v = variants[index]
        binding.btnQuality.text = v.label
        binding.btnDownloadMovie.visibility = if (v.downloadUrl.isNotBlank()) View.VISIBLE else View.GONE
        playUri(v.url, seekMs)
    }

    private fun playUri(uriString: String, seekMs: Long) {
        val exo = player ?: return
        val builder = MediaItem.Builder().setUri(uriString)
        if (film.id == "sintel" || film.id == "steel") {
            val subUri = Uri.parse("asset:///media/${film.id}-en.vtt")
            builder.setSubtitleConfigurations(
                listOf(
                    MediaItem.SubtitleConfiguration.Builder(subUri)
                        .setMimeType(MimeTypes.TEXT_VTT)
                        .setLanguage("en")
                        .setLabel("English")
                        .build()
                )
            )
        }
        exo.setMediaItem(builder.build())
        exo.prepare()
        if (seekMs > 0L) exo.seekTo(seekMs)
        exo.playWhenReady = true
    }

    private fun showQualityPicker() {
        if (variants.isNotEmpty()) {
            val labels = variants.map { it.label }.toTypedArray()
            AlertDialog.Builder(this)
                .setTitle("Available Quality")
                .setSingleChoiceItems(labels, variantIndex) { dialog, idx ->
                    val pos = player?.currentPosition ?: 0L
                    playDirectVariant(idx, pos)
                    dialog.dismiss()
                }
                .show()
        } else {
            showTrackPicker(C.TRACK_TYPE_VIDEO, "Video Quality")
        }
    }

    private fun showTrackPicker(trackType: Int, title: String) {
        val exo = player ?: return
        val groups = exo.currentTracks.groups.filter { it.type == trackType }
        val options = mutableListOf<Pair<String, (() -> Unit)>>()
        options.add("Auto / Off" to {
            trackSelector.setParameters(
                trackSelector.buildUponParameters().clearOverridesOfType(trackType)
            )
        })
        groups.forEach { group ->
            for (i in 0 until group.length) {
                val fmt = group.getTrackFormat(i)
                val label = when (trackType) {
                    C.TRACK_TYPE_VIDEO -> if (fmt.height > 0) "${fmt.height}p" else "Track ${i + 1}"
                    else -> fmt.label ?: fmt.language ?: "Track ${i + 1}"
                }
                options.add(label to {
                    trackSelector.setParameters(
                        trackSelector.buildUponParameters()
                            .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, i))
                    )
                })
            }
        }
        if (options.size <= 1) {
            Toast.makeText(this, "No alternate $title available", Toast.LENGTH_SHORT).show()
            return
        }
        AlertDialog.Builder(this)
            .setTitle(title)
            .setItems(options.map { it.first }.toTypedArray()) { _, which ->
                options[which].second.invoke()
            }
            .show()
    }

    private fun startAuthorizedDownload() {
        val v = variants.getOrNull(variantIndex)?.takeIf { it.downloadUrl.isNotBlank() } ?: return
        val sizeMb = if (v.sizeBytes > 0) String.format("%.1f MiB", v.sizeBytes / 1048576.0) else "Unknown size"
        AlertDialog.Builder(this)
            .setTitle("Download ${film.title}")
            .setMessage("Quality: ${v.label}\nSize: $sizeMb\n\nDownload for authorized offline viewing?")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Download") { _, _ ->
                val safeName = film.title.replace(Regex("[^a-zA-Z0-9 _-]"), "").ifBlank { "ZeeFlix" } + ".mp4"
                val req = DownloadManager.Request(Uri.parse(v.downloadUrl))
                    .setTitle("${film.title} (${v.label})")
                    .setDescription("ZeeFlix authorized download")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, safeName)
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val dlId = dm.enqueue(req)
                store.addDownload(DownloadRecord(dlId, film.id, film.title, v.label, v.downloadUrl, v.sizeBytes))
                Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun mountEmbed(url: String) {
        if (!SourceValidator.isSafeEmbed(url)) {
            binding.playerStatus.text = "Embed host not allowlisted."
            return
        }
        embedMode = true
        binding.playerStatus.visibility = View.GONE
        binding.playerView.visibility = View.GONE
        binding.playerOptionsBar.visibility = View.GONE
        binding.embedWebView.visibility = View.VISIBLE
        binding.embedWebView.settings.javaScriptEnabled = true
        binding.embedWebView.settings.mediaPlaybackRequiresUserGesture = false
        binding.embedWebView.webChromeClient = WebChromeClient()
        binding.embedWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val next = request?.url?.toString().orEmpty()
                return !SourceValidator.isSafeSource(next)
            }
        }
        binding.embedWebView.loadUrl(url)
    }

    private fun saveProgress() {
        val exo = player ?: return
        val dur = (exo.duration / 1000L).toInt()
        val pos = (exo.currentPosition / 1000L).toInt()
        if (dur > 0 && pos >= 1) {
            store.recordProgress(film.id, pos, dur)
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        val vis = if (isInPictureInPictureMode) View.GONE else View.VISIBLE
        binding.playerTopOverlay.visibility = vis
        // Embedded players use the provider's own controls; the local options bar must
        // never reappear over an embed (for example when leaving Picture-in-Picture).
        val optionsVis = if (isInPictureInPictureMode || embedMode) View.GONE else View.VISIBLE
        binding.playerOptionsBar.visibility = optionsVis
    }

    override fun onPause() {
        saveProgress()
        super.onPause()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) return
        player?.pause()
    }

    override fun onDestroy() {
        saveProgress()
        player?.release()
        player = null
        binding.embedWebView.destroy()
        super.onDestroy()
    }
}
