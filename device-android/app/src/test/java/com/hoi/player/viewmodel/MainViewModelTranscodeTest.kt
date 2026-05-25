package com.hoi.player.viewmodel

import com.hoi.player.assets.TranscodeEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MainViewModelTranscodeTest {

    @Test
    fun transcodeUiEvent_mapsDomainEvents() {
        assertEquals(TranscodeUiEvent.Queued(7), TranscodeUiEvent.from(TranscodeEvent.Queued(7)))
        assertEquals(
            TranscodeUiEvent.Running(7, 0.5f),
            TranscodeUiEvent.from(TranscodeEvent.Running(7, 0.5f))
        )
        assertEquals(TranscodeUiEvent.Ready(7), TranscodeUiEvent.from(TranscodeEvent.Ready(7)))
        assertEquals(TranscodeUiEvent.Failed(7), TranscodeUiEvent.from(TranscodeEvent.Failed(7)))
    }

    @Test
    fun transcodeUiEvent_readyIsDistinctType() {
        val event: TranscodeUiEvent = TranscodeUiEvent.from(TranscodeEvent.Ready(53))
        assertTrue(event is TranscodeUiEvent.Ready)
        assertEquals(53, (event as TranscodeUiEvent.Ready).fileId)
    }
}
