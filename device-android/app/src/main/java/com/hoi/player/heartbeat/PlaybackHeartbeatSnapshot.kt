package com.hoi.player.heartbeat

data class PlaybackHeartbeatSnapshot(
    val playbackState: String = PLAYBACK_NOT_PLAYING,
    val healthStatus: String = HEALTH_OK,
    val currentlyPlaying: String = NOT_PLAYING_LABEL,
    val currentItemLabel: String? = null
) {
    companion object {
        const val PLAYBACK_PLAYING = "playing"
        const val PLAYBACK_IDLE = "idle"
        const val PLAYBACK_NOT_PLAYING = "not_playing"
        const val PLAYBACK_ERROR = "error"
        const val PLAYBACK_SETUP = "setup"
        const val PLAYBACK_APP_CLOSED = "app_closed"

        const val HEALTH_OK = "ok"
        const val HEALTH_WARNING = "warning"
        const val HEALTH_ERROR = "error"

        const val NOT_PLAYING_LABEL = "not_playing"
    }
}
