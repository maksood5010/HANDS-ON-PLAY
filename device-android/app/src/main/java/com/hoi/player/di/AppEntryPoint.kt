package com.hoi.player.di

import com.hoi.player.heartbeat.AppForegroundTracker
import com.hoi.player.update.AppUpdateRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AppEntryPoint {
    fun appForegroundTracker(): AppForegroundTracker
    fun appUpdateRepository(): AppUpdateRepository
}
