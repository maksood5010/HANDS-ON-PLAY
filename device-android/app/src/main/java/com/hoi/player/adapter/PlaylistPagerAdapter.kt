package com.hoi.player.adapter

import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.hoi.player.R
import com.hoi.player.assets.VideoAssetStore
import com.hoi.player.models.PlaylistItem
import com.hoi.player.models.isVideo
import com.hoi.player.models.resolveVideoPlaybackUri
import androidx.media3.ui.PlayerView
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.hoi.player.playback.PlaybackService
import com.hoi.player.playback.isStuckBufferingAtStart
import com.hoi.player.playback.needsMediaReload
import com.hoi.player.playback.needsSeekToStart

class PlaylistPagerAdapter(
    private val appContext: Context,
    private val videoAssetStore: VideoAssetStore,
    private val onVideoEnded: () -> Unit,
    private val onVideoError: () -> Unit
) : ListAdapter<PlaylistItem, RecyclerView.ViewHolder>(PlaylistItemDiffCallback()) {
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private var controllerListener: Player.Listener? = null
    private var currentVideoUrl: String? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var bufferingWatchdogAttempt = 0
    private val bufferingWatchdogRunnable = Runnable { onBufferingWatchdogFired() }

    var currentPosition: Int = 0
        set(value) {
            val old = field
            if (old != value) {
                cancelBufferingWatchdog()
                field = value
                notifyItemChanged(old)
                notifyItemChanged(value)
            }
        }

    override fun getItemViewType(position: Int): Int {
        val item = getItem(position)
        return if (item.fileType.equals("video", ignoreCase = true)) TYPE_VIDEO else TYPE_IMAGE
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            TYPE_IMAGE -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_playlist_image, parent, false)
                ImageViewHolder(view)
            }
            TYPE_VIDEO -> {
                ensureController(parent)
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_playlist_video, parent, false)
                VideoViewHolder(view, ::handleBindVideo)
            }
            else -> throw IllegalArgumentException("Unknown view type: $viewType")
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = getItem(position)
        when (holder) {
            is ImageViewHolder -> holder.bind(item)
            is VideoViewHolder -> holder.bind(item, position == currentPosition)
        }
    }

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        super.onViewRecycled(holder)
        if (holder is VideoViewHolder) {
            holder.release()
        }
    }

    override fun onDetachedFromRecyclerView(recyclerView: RecyclerView) {
        super.onDetachedFromRecyclerView(recyclerView)
        releaseController()
    }

    fun pausePlayback() {
        cancelBufferingWatchdog()
        controller?.pause()
    }

    fun restartPlayback() {
        val ctrl = controller ?: return
        val url = currentVideoUrl ?: currentItemPlaybackUri() ?: return
        startVideoPlayback(ctrl, url, forceReload = needsMediaReload(ctrl.playbackState))
    }

    fun resumeCurrentVideo() {
        val uri = currentItemPlaybackUri() ?: return
        val ctrl = controller ?: return
        startVideoPlayback(ctrl, uri)
    }

    /**
     * Call this when a brand-new playlist is loaded (e.g., after hitting the end and re-fetching).
     * It forces the next visible video item to re-prepare even if the URL matches the previous one.
     */
    fun onPlaylistRefreshed() {
        cancelBufferingWatchdog()
        currentVideoUrl = null
        rebindCurrentVideoIfNeeded()
    }

    class ImageViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val imageView: ImageView = view.findViewById(R.id.imageView)

        fun bind(item: PlaylistItem) {
            val url = item.fileUrl ?: return
            Glide.with(itemView.context)
                .load(url)
                .transition(DrawableTransitionOptions.withCrossFade())
                .centerCrop()
                .into(imageView)
        }
    }

    class VideoViewHolder(
        view: View,
        private val binder: (playerView: PlayerView, item: PlaylistItem, isCurrentPage: Boolean) -> Unit
    ) : RecyclerView.ViewHolder(view) {

        private val playerView: PlayerView = view.findViewById(R.id.playerView)

        fun bind(item: PlaylistItem, isCurrentPage: Boolean) {
            binder(playerView, item, isCurrentPage)
        }

        fun release() {
            playerView.player = null
        }
    }

    private fun ensureController(parent: ViewGroup) {
        if (controller != null || controllerFuture != null) return

        val context = parent.context.applicationContext
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        controllerFuture = future

        future.addListener(
            {
                try {
                    val built = future.get()
                    controller = built
                    attachControllerListener(built)
                    notifyDataSetChanged()
                } catch (t: Throwable) {
                    Log.e(TAG, "Failed to build MediaController", t)
                    controllerFuture = null
                }
            },
            MoreExecutors.directExecutor()
        )
    }

    private fun attachControllerListener(ctrl: MediaController) {
        if (controllerListener != null) return
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_ENDED -> onVideoEnded()
                    Player.STATE_BUFFERING -> scheduleBufferingWatchdogIfNeeded()
                    Player.STATE_READY -> {
                        cancelBufferingWatchdog()
                        bufferingWatchdogAttempt = 0
                    }
                    else -> cancelBufferingWatchdog()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                cancelBufferingWatchdog()
                onVideoError()
            }
        }
        ctrl.addListener(listener)
        controllerListener = listener
    }

    private fun handleBindVideo(playerView: PlayerView, item: PlaylistItem, isCurrentPage: Boolean) {
        val uri = item.resolveVideoPlaybackUri(videoAssetStore) ?: return
        val ctrl = controller

        playerView.player = ctrl

        if (ctrl == null) return

        if (isCurrentPage) {
            startVideoPlayback(ctrl, uri)
        } else {
            cancelBufferingWatchdog()
            ctrl.pause()
        }
    }

    private fun startVideoPlayback(
        ctrl: MediaController,
        uri: String,
        forceReload: Boolean = false
    ) {
        logCurrentVideoPlayback(uri, forceReload)

        val state = ctrl.playbackState
        if (forceReload || currentVideoUrl != uri || needsMediaReload(state)) {
            currentVideoUrl = uri
            ctrl.setMediaItem(PlaybackService.mediaItem(uri))
            ctrl.prepare()
        } else if (needsSeekToStart(state)) {
            ctrl.seekTo(0)
        }
        ctrl.playWhenReady = true
        ctrl.play()
    }

    private fun rebindCurrentVideoIfNeeded() {
        val pos = currentPosition
        if (pos !in 0 until itemCount) return
        if (!getItem(pos).isVideo()) return
        notifyItemChanged(pos)
    }

    private fun scheduleBufferingWatchdogIfNeeded() {
        if (!isCurrentItemVideo()) return
        cancelBufferingWatchdog()
        val delayMs = if (bufferingWatchdogAttempt == 0) {
            BUFFERING_WATCHDOG_MS
        } else {
            BUFFERING_WATCHDOG_RETRY_MS
        }
        mainHandler.postDelayed(bufferingWatchdogRunnable, delayMs)
    }

    private fun onBufferingWatchdogFired() {
        val ctrl = controller ?: return
        if (!isCurrentItemVideo()) return
        if (!isStuckBufferingAtStart(ctrl.playbackState, ctrl.currentPosition, ctrl.isPlaying)) {
            bufferingWatchdogAttempt = 0
            return
        }

        val uri = currentVideoUrl ?: currentItemPlaybackUri()
        if (uri == null) {
            onVideoError()
            return
        }

        if (bufferingWatchdogAttempt == 0) {
            Log.w(TAG, "Video stuck buffering at start; forcing reload uri=$uri")
            bufferingWatchdogAttempt = 1
            startVideoPlayback(ctrl, uri, forceReload = true)
            scheduleBufferingWatchdogIfNeeded()
        } else {
            Log.w(TAG, "Video still stuck after reload; skipping uri=$uri")
            bufferingWatchdogAttempt = 0
            onVideoError()
        }
    }

    private fun isCurrentItemVideo(): Boolean {
        val pos = currentPosition
        if (pos !in 0 until itemCount) return false
        return getItem(pos).isVideo()
    }

    private fun currentItemPlaybackUri(): String? {
        val pos = currentPosition
        if (pos !in 0 until itemCount) return null
        if (!getItem(pos).isVideo()) return null
        return getItem(pos).resolveVideoPlaybackUri(videoAssetStore)
    }

    private fun logCurrentVideoPlayback(uri: String, forceReload: Boolean) {
        val pos = currentPosition
        val item = if (pos in 0 until itemCount) getItem(pos) else null
        val source = if (uri.startsWith("file:")) "local" else "remote"
        Log.i(
            TAG,
            "Playing video pos=$pos name=${item?.originalName} fileId=${item?.fileId} " +
                "source=$source forceReload=$forceReload uri=$uri"
        )
    }

    private fun cancelBufferingWatchdog() {
        mainHandler.removeCallbacks(bufferingWatchdogRunnable)
    }

    private fun releaseController() {
        cancelBufferingWatchdog()
        bufferingWatchdogAttempt = 0

        controllerListener?.let { listener ->
            controller?.removeListener(listener)
        }
        controllerListener = null

        controller?.release()
        controller = null

        controllerFuture?.cancel(true)
        controllerFuture = null
        currentVideoUrl = null
    }

    private class PlaylistItemDiffCallback : DiffUtil.ItemCallback<PlaylistItem>() {
        override fun areItemsTheSame(oldItem: PlaylistItem, newItem: PlaylistItem): Boolean {
            return oldItem.id == newItem.id
        }
        override fun areContentsTheSame(oldItem: PlaylistItem, newItem: PlaylistItem): Boolean {
            return oldItem == newItem
        }
    }

    companion object {
        private const val TAG = "PlaylistPagerAdapter"
        private const val TYPE_IMAGE = 0
        private const val TYPE_VIDEO = 1
        private const val BUFFERING_WATCHDOG_MS = 20_000L
        private const val BUFFERING_WATCHDOG_RETRY_MS = 10_000L
    }
}
