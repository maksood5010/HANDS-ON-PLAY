package com.hoi.player.viewmodel

sealed class PlaybackGateState {
    data object Open : PlaybackGateState()

    data class Blocked(
        val fileId: Int,
        val label: String?,
        val progressPercent: Int
    ) : PlaybackGateState()
}
