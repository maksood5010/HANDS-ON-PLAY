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

    @Test
    fun shouldMonitorPlaybackStall_trueWhenPlayingAndReady() {
        assertTrue(shouldMonitorPlaybackStall(true, Player.STATE_READY))
        assertTrue(shouldMonitorPlaybackStall(true, Player.STATE_BUFFERING))
    }

    @Test
    fun shouldMonitorPlaybackStall_falseWhenIdleOrEnded() {
        assertFalse(shouldMonitorPlaybackStall(true, Player.STATE_IDLE))
        assertFalse(shouldMonitorPlaybackStall(true, Player.STATE_ENDED))
        assertFalse(shouldMonitorPlaybackStall(false, Player.STATE_READY))
    }

    @Test
    fun isPositionStalled_detectsFrozenPosition() {
        assertTrue(isPositionStalled(lastAdvanceAtMs = 0L, nowMs = 3_000L))
        assertFalse(isPositionStalled(lastAdvanceAtMs = 0L, nowMs = 2_999L))
    }
}
