package com.hoi.player.assets

sealed class TranscodeEvent {
    data class Queued(val fileId: Int) : TranscodeEvent()
    data class Running(val fileId: Int, val progress: Float) : TranscodeEvent()
    data class Ready(val fileId: Int) : TranscodeEvent()
    data class Failed(val fileId: Int) : TranscodeEvent()
}
