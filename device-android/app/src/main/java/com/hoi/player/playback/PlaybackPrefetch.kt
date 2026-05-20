package com.hoi.player.playback

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import com.hoi.player.MyApp
import java.util.concurrent.Executors
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

        executor.execute {
            try {
                cacheInitialBytes(url)
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

        val dataSpec = DataSpec.Builder()
            .setUri(Uri.parse(url))
            .setLength(PREFETCH_LENGTH_BYTES)
            .build()

        CacheWriter(
            cacheDataSourceFactory.createDataSource(),
            dataSpec,
            null,
            null
        ).cache()
    }
}
