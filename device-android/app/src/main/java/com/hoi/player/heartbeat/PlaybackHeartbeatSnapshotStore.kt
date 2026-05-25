package com.hoi.player.heartbeat

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackHeartbeatSnapshotStore @Inject constructor() {
    private val _snapshot = MutableStateFlow(PlaybackHeartbeatSnapshot())
    val snapshot: StateFlow<PlaybackHeartbeatSnapshot> = _snapshot.asStateFlow()

    fun update(transform: (PlaybackHeartbeatSnapshot) -> PlaybackHeartbeatSnapshot) {
        _snapshot.value = transform(_snapshot.value)
    }

    fun current(): PlaybackHeartbeatSnapshot = _snapshot.value
}
