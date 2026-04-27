package com.hoi.player.adapter

import android.content.ComponentName
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
import com.hoi.player.models.PlaylistItem
import androidx.media3.ui.PlayerView
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.hoi.player.playback.PlaybackService

class PlaylistPagerAdapter(
    private val onVideoEnded: () -> Unit,
    private val onVideoError: () -> Unit
) : ListAdapter<PlaylistItem, RecyclerView.ViewHolder>(PlaylistItemDiffCallback()) {

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private var controllerListener: Player.Listener? = null
    private var currentVideoUrl: String? = null

    var currentPosition: Int = 0
        set(value) {
            val old = field
            if (old != value) {
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
        controller?.pause()
    }

    fun restartPlayback() {
        val ctrl = controller ?: return
        // If a single-item playlist ends, the page won't change; restart locally.
        ctrl.seekTo(0)
        ctrl.playWhenReady = true
        ctrl.play()
    }

    /**
     * Call this when a brand-new playlist is loaded (e.g., after hitting the end and re-fetching).
     * It forces the next visible video item to re-prepare even if the URL matches the previous one.
     */
    fun onPlaylistRefreshed() {
        currentVideoUrl = null
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
                    Log.e("PlaylistPagerAdapter", "Failed to build MediaController", t)
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
                if (playbackState == Player.STATE_ENDED) {
                    onVideoEnded()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                onVideoError()
            }
        }
        ctrl.addListener(listener)
        controllerListener = listener
    }

    private fun handleBindVideo(playerView: PlayerView, item: PlaylistItem, isCurrentPage: Boolean) {
        val url = item.fileUrl ?: return
        val ctrl = controller

        // Always detach until controller exists, to avoid a stale player reference.
        playerView.player = ctrl

        if (ctrl == null) return

        if (isCurrentPage) {
            if (currentVideoUrl != url) {
                currentVideoUrl = url
                ctrl.setMediaItem(PlaybackService.mediaItem(url))
                ctrl.prepare()
            }
            // If the same URL is reused and the player is in ENDED, explicitly restart.
            if (ctrl.playbackState == Player.STATE_ENDED) {
                ctrl.seekTo(0)
            }
            ctrl.playWhenReady = true
            ctrl.play()
        } else {
            ctrl.pause()
        }
    }

    private fun releaseController() {
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
        private const val TYPE_IMAGE = 0
        private const val TYPE_VIDEO = 1
    }
}
