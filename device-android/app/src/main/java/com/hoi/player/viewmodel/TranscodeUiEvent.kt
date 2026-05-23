package com.hoi.player.viewmodel

import com.hoi.player.assets.TranscodeEvent

sealed class TranscodeUiEvent {
    data class Queued(val fileId: Int) : TranscodeUiEvent()
    data class Running(val fileId: Int, val progress: Float) : TranscodeUiEvent()
    data class Ready(val fileId: Int) : TranscodeUiEvent()
    data class Failed(val fileId: Int) : TranscodeUiEvent()
    data class PrepareSkipped(val fileId: Int) : TranscodeUiEvent()

    companion object {
        fun from(event: TranscodeEvent): TranscodeUiEvent = when (event) {
            is TranscodeEvent.Queued -> Queued(event.fileId)
            is TranscodeEvent.Running -> Running(event.fileId, event.progress)
            is TranscodeEvent.Ready -> Ready(event.fileId)
            is TranscodeEvent.Failed -> Failed(event.fileId)
        }
    }
}
