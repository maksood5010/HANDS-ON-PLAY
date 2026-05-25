package com.hoi.player

import android.app.Application
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import com.hoi.player.di.AppEntryPoint
import com.hoi.player.network.ConnectivityRestoreMonitor
import com.hoi.player.utils.PreferencesManager
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import java.io.File

@UnstableApi
@HiltAndroidApp
class MyApp : Application() {

    private lateinit var connectivityRestoreMonitor: ConnectivityRestoreMonitor

    override fun onCreate() {
        super.onCreate()
        instance = this
        PreferencesManager.with(this)
        connectivityRestoreMonitor = ConnectivityRestoreMonitor(applicationContext)
        connectivityRestoreMonitor.start()

        EntryPointAccessors.fromApplication(this, AppEntryPoint::class.java)
            .appForegroundTracker()
            .start()
    }

    override fun onTerminate() {
        if (::connectivityRestoreMonitor.isInitialized) {
            connectivityRestoreMonitor.stop()
        }
        super.onTerminate()
    }

    companion object {
        lateinit var instance: MyApp

        @get:OptIn(UnstableApi::class)
        val exoCache: SimpleCache by lazy {
            val cacheSize = 100 * 1024 * 1024L // 100MB stream fallback only
            val cacheEvictor = LeastRecentlyUsedCacheEvictor(cacheSize)
            val databaseProvider = StandaloneDatabaseProvider(instance)
            SimpleCache(File(instance.cacheDir, "exo_cache"), cacheEvictor, databaseProvider)
        }
    }
}
