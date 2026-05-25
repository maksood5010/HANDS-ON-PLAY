package com.hoi.player.heartbeat

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppForegroundTracker @Inject constructor() : DefaultLifecycleObserver {

    @Volatile
    private var inForeground: Boolean = false

    @Volatile
    private var started = false

    fun start() {
        if (started) return
        started = true
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    override fun onStart(owner: LifecycleOwner) {
        inForeground = true
    }

    override fun onStop(owner: LifecycleOwner) {
        inForeground = false
    }

    fun isInForeground(): Boolean = inForeground
}
