package com.hoi.player.heartbeat

import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackHeartbeatCollector @Inject constructor(
    private val snapshotStore: PlaybackHeartbeatSnapshotStore
) {
    private var attachedController: MediaController? = null
    private var listener: Player.Listener? = null
    /** True while an image (non-ExoPlayer) slide is on screen — do not overwrite from idle player. */
    private var staticSlideActive = false

    fun attach(controller: MediaController) {
        if (attachedController === controller && listener != null) return
        detach()
        attachedController = controller

        val playerListener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                pushFromPlayer(controller)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                pushFromPlayer(controller)
            }

            override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
                pushFromPlayer(controller)
            }

            override fun onPlayerError(error: PlaybackException) {
                snapshotStore.update {
                    it.copy(
                        playbackState = PlaybackHeartbeatSnapshot.PLAYBACK_ERROR,
                        healthStatus = PlaybackHeartbeatSnapshot.HEALTH_ERROR
                    )
                }
            }
        }
        listener = playerListener
        controller.addListener(playerListener)
        pushFromPlayer(controller)
    }

    fun detach() {
        val ctrl = attachedController
        val l = listener
        if (ctrl != null && l != null) {
            ctrl.removeListener(l)
        }
        attachedController = null
        listener = null
        staticSlideActive = false
    }

    /** Image / non-video slide: no MediaController updates; report as playing on the heartbeat. */
    fun updateDisplayedStaticItem(playbackUrl: String?, displayLabel: String?) {
        staticSlideActive = true
        val url = playbackUrl?.trim()?.takeIf { it.isNotEmpty() }
        val label = displayLabel?.trim()?.takeIf { it.isNotEmpty() }
        snapshotStore.update { snap ->
            snap.copy(
                currentItemLabel = label,
                currentlyPlaying = url ?: PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL,
                playbackState = if (url != null) {
                    PlaybackHeartbeatSnapshot.PLAYBACK_PLAYING
                } else {
                    PlaybackHeartbeatSnapshot.PLAYBACK_NOT_PLAYING
                },
                healthStatus = clearOkUnlessWarningOrError(snap.healthStatus)
            )
        }
    }

    fun updateCurrentItemLabel(displayLabel: String?, playbackUrl: String?) {
        staticSlideActive = false
        val url = playbackUrl?.trim()?.takeIf { it.isNotEmpty() }
        val label = displayLabel?.trim()?.takeIf { it.isNotEmpty() }
        snapshotStore.update { snap ->
            snap.copy(
                currentItemLabel = label,
                currentlyPlaying = url ?: PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
            )
        }
        attachedController?.let { pushFromPlayer(it) }
    }

    fun updateHealthWarning(isWarning: Boolean) {
        snapshotStore.update { snap ->
            snap.copy(
                healthStatus = if (isWarning) {
                    PlaybackHeartbeatSnapshot.HEALTH_WARNING
                } else if (snap.healthStatus == PlaybackHeartbeatSnapshot.HEALTH_WARNING) {
                    PlaybackHeartbeatSnapshot.HEALTH_OK
                } else {
                    snap.healthStatus
                }
            )
        }
    }

    private fun pushFromPlayer(controller: MediaController) {
        if (staticSlideActive) return

        val playbackState = mapPlaybackState(controller)
        snapshotStore.update { snap ->
            val currentlyPlaying = snap.currentlyPlaying.takeIf { current ->
                current.isNotBlank() &&
                    current != PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
            } ?: PlaybackHeartbeatSnapshot.NOT_PLAYING_LABEL
            snap.copy(
                playbackState = playbackState,
                currentlyPlaying = currentlyPlaying,
                healthStatus = if (snap.healthStatus == PlaybackHeartbeatSnapshot.HEALTH_ERROR) {
                    snap.healthStatus
                } else if (snap.healthStatus == PlaybackHeartbeatSnapshot.HEALTH_WARNING) {
                    snap.healthStatus
                } else {
                    PlaybackHeartbeatSnapshot.HEALTH_OK
                }
            )
        }
    }

    private fun mapPlaybackState(controller: Player): String {
        if (controller.playerError != null) {
            return PlaybackHeartbeatSnapshot.PLAYBACK_ERROR
        }
        return when (controller.playbackState) {
            Player.STATE_BUFFERING -> {
                if (controller.isPlaying) PlaybackHeartbeatSnapshot.PLAYBACK_PLAYING
                else PlaybackHeartbeatSnapshot.PLAYBACK_IDLE
            }
            Player.STATE_READY -> {
                if (controller.isPlaying) PlaybackHeartbeatSnapshot.PLAYBACK_PLAYING
                else if (controller.mediaItemCount == 0) PlaybackHeartbeatSnapshot.PLAYBACK_NOT_PLAYING
                else PlaybackHeartbeatSnapshot.PLAYBACK_IDLE
            }
            Player.STATE_ENDED -> PlaybackHeartbeatSnapshot.PLAYBACK_IDLE
            Player.STATE_IDLE -> {
                if (controller.mediaItemCount == 0) PlaybackHeartbeatSnapshot.PLAYBACK_NOT_PLAYING
                else PlaybackHeartbeatSnapshot.PLAYBACK_IDLE
            }
            else -> PlaybackHeartbeatSnapshot.PLAYBACK_NOT_PLAYING
        }
    }

    private fun clearOkUnlessWarningOrError(health: String): String =
        when (health) {
            PlaybackHeartbeatSnapshot.HEALTH_WARNING,
            PlaybackHeartbeatSnapshot.HEALTH_ERROR -> health
            else -> PlaybackHeartbeatSnapshot.HEALTH_OK
        }
}
