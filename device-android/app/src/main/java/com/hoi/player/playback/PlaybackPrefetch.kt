package com.hoi.player.playback

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.hoi.player.MyApp
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@OptIn(UnstableApi::class)
object PlaybackPrefetch {

    private const val TAG = "PlaybackPrefetch"
    private const val PREFETCH_LENGTH_BYTES = 5L * 1024 * 1024 // 5 MB for progressive MP4

    private val executor = Executors.newSingleThreadExecutor()
    private val lastPrefetchedUrl = AtomicReference<String?>(null)

    fun prefetch(context: Context, url: String) {
        if (url.isBlank()) return
        if (url == lastPrefetchedUrl.get()) return
        lastPrefetchedUrl.set(url)

        val appContext = context.applicationContext
        executor.execute {
            try {
                cacheInitialBytes(url)
                if (isHlsUrl(url)) {
                    warmHlsWithPlayer(appContext, url)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Prefetch failed for $url", t)
                if (lastPrefetchedUrl.get() == url) {
                    lastPrefetchedUrl.set(null)
                }
            }
        }
    }

    fun reset() {
        lastPrefetchedUrl.set(null)
    }

    private fun cacheInitialBytes(url: String) {
        val cacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(MyApp.exoCache)
            .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory())
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val length = if (isHlsUrl(url)) C.LENGTH_UNSET.toLong() else PREFETCH_LENGTH_BYTES
        val dataSpec = DataSpec.Builder()
            .setUri(Uri.parse(url))
            .setLength(length)
            .build()

        CacheWriter(
            cacheDataSourceFactory.createDataSource(),
            dataSpec,
            null,
            null
        ).cache()
    }

    private fun warmHlsWithPlayer(context: Context, url: String) {
        val cacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(MyApp.exoCache)
            .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory())
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val mediaSourceFactory = DefaultMediaSourceFactory(cacheDataSourceFactory)
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(30_000, 60_000, 1_500, 3_000)
            .build()

        val player = ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .build()

        try {
            val latch = java.util.concurrent.CountDownLatch(1)
            val listener = object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY || playbackState == Player.STATE_ENDED) {
                        latch.countDown()
                    }
                }
            }
            player.addListener(listener)
            player.setMediaItem(PlaybackService.mediaItem(url))
            player.prepare()
            latch.await(45, TimeUnit.SECONDS)
        } finally {
            player.release()
        }
    }

    private fun isHlsUrl(url: String): Boolean =
        url.contains(".m3u8", ignoreCase = true)
}
