package com.hoi.player.assets

import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.cache.Cache
import com.hoi.player.MyApp
import javax.inject.Inject
import javax.inject.Singleton

@OptIn(UnstableApi::class)
@Singleton
class ExoCacheCleaner @Inject constructor() {

    private val cache: Cache
        get() = MyApp.exoCache

    fun removeUrls(urls: Collection<String>) {
        if (urls.isEmpty()) return
        for (url in urls.distinct()) {
            try {
                cache.removeResource(url)
                Log.d(TAG, "Removed Exo cache resource url=$url")
            } catch (t: Throwable) {
                Log.w(TAG, "Failed to remove Exo cache resource url=$url", t)
            }
        }
    }

    fun removeEntries(entries: Collection<VideoAssetEntry>) {
        removeUrls(entries.map { it.fileUrl })
    }

    companion object {
        private const val TAG = "VideoAssetSync"
    }
}
