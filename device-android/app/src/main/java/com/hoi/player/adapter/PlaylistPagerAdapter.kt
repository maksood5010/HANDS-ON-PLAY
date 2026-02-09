package com.hoi.player.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.hoi.player.MyApp
import com.hoi.player.R
import com.hoi.player.models.PlaylistItem
import androidx.media3.ui.PlayerView

class PlaylistPagerAdapter(
    private val onVideoEnded: () -> Unit,
    private val onVideoError: () -> Unit
) : ListAdapter<PlaylistItem, RecyclerView.ViewHolder>(PlaylistItemDiffCallback()) {

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
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_playlist_video, parent, false)
                VideoViewHolder(view, onVideoEnded, onVideoError)
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

    @OptIn(UnstableApi::class)
    class VideoViewHolder(
        view: View,
        private val onVideoEnded: () -> Unit,
        private val onVideoError: () -> Unit
    ) : RecyclerView.ViewHolder(view) {

        private val playerView: PlayerView = view.findViewById(R.id.playerView)
        private var player: ExoPlayer? = null

        fun bind(item: PlaylistItem, isCurrentPage: Boolean) {
            release()
            val url = item.fileUrl ?: return
            val context = itemView.context.applicationContext

            val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            val cacheDataSourceFactory = CacheDataSource.Factory()
                .setCache(MyApp.exoCache)
                .setUpstreamDataSourceFactory(httpDataSourceFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

            val mediaSourceFactory = ProgressiveMediaSource.Factory(cacheDataSourceFactory)
            val exoPlayer = ExoPlayer.Builder(context)
                .setMediaSourceFactory(mediaSourceFactory)
                .build()
                .apply {
                    setMediaItem(MediaItem.fromUri(url))
                    repeatMode = Player.REPEAT_MODE_OFF
                    playWhenReady = isCurrentPage
                    addListener(object : Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == Player.STATE_ENDED) {
                                onVideoEnded()
                            }
                        }
                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            onVideoError()
                        }
                    })
                    prepare()
                }
            player = exoPlayer
            playerView.player = exoPlayer
        }

        fun release() {
            player?.release()
            player = null
            playerView.player = null
        }
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
