package com.hoi.player.heartbeat

import com.google.gson.Gson
import com.hoi.player.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceStatusPayloadBuilder @Inject constructor(
    private val snapshotStore: PlaybackHeartbeatSnapshotStore,
    private val appForegroundTracker: AppForegroundTracker,
    private val gson: Gson
) {

    fun buildJson(deviceKey: String): String {
        val snapshot = snapshotStore.current()
        val inForeground = appForegroundTracker.isInForeground()

        val playbackState = if (!inForeground) {
            PlaybackHeartbeatSnapshot.PLAYBACK_APP_CLOSED
        } else {
            snapshot.playbackState
        }

        val currentlyPlaying = if (!inForeground) {
            PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
        } else {
            snapshot.currentlyPlaying.takeIf { value ->
                value.isNotBlank() &&
                    value != PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
            } ?: PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
        }

        val body = mapOf(
            "device_key" to deviceKey,
            "playback_state" to playbackState,
            "health_status" to snapshot.healthStatus,
            "currently_playing" to currentlyPlaying,
            "app_version" to BuildConfig.VERSION_NAME
        )
        return gson.toJson(body)
    }
}
