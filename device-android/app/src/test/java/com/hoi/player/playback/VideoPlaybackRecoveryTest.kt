package com.hoi.player.playback

import androidx.media3.common.Player
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoPlaybackRecoveryTest {

    @Test
    fun needsMediaReload_trueOnlyForIdle() {
        assertTrue(needsMediaReload(Player.STATE_IDLE))
        assertFalse(needsMediaReload(Player.STATE_READY))
        assertFalse(needsMediaReload(Player.STATE_BUFFERING))
        assertFalse(needsMediaReload(Player.STATE_ENDED))
    }

    @Test
    fun needsSeekToStart_trueOnlyForEnded() {
        assertTrue(needsSeekToStart(Player.STATE_ENDED))
        assertFalse(needsSeekToStart(Player.STATE_READY))
        assertFalse(needsSeekToStart(Player.STATE_IDLE))
    }

    @Test
    fun isStuckBufferingAtStart_detectsBufferingAtZero() {
        assertTrue(
            isStuckBufferingAtStart(
                playbackState = Player.STATE_BUFFERING,
                currentPositionMs = 0L,
                isPlaying = false
            )
        )
        assertTrue(
            isStuckBufferingAtStart(
                playbackState = Player.STATE_BUFFERING,
                currentPositionMs = 400L,
                isPlaying = false
            )
        )
    }

    @Test
    fun isStuckBufferingAtStart_falseWhenPlayingOrPastStart() {
        assertFalse(
            isStuckBufferingAtStart(
                playbackState = Player.STATE_BUFFERING,
                currentPositionMs = 0L,
                isPlaying = true
            )
        )
        assertFalse(
            isStuckBufferingAtStart(
                playbackState = Player.STATE_BUFFERING,
                currentPositionMs = 1_000L,
                isPlaying = false
            )
        )
        assertFalse(
            isStuckBufferingAtStart(
                playbackState = Player.STATE_READY,
                currentPositionMs = 0L,
                isPlaying = false
            )
        )
    }
}
