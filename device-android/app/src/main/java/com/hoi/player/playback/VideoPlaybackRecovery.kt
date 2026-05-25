package com.hoi.player.playback

import androidx.media3.common.Player

fun needsMediaReload(playbackState: Int): Boolean =
    playbackState == Player.STATE_IDLE

fun needsSeekToStart(playbackState: Int): Boolean =
    playbackState == Player.STATE_ENDED

fun isStuckBufferingAtStart(
    playbackState: Int,
    currentPositionMs: Long,
    isPlaying: Boolean
): Boolean =
    playbackState == Player.STATE_BUFFERING &&
        currentPositionMs <= 500L &&
        !isPlaying
