package com.hoi.player.di

import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AssetModule {

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()
}
