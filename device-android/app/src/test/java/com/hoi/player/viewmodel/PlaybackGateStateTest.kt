package com.hoi.player.viewmodel

import com.hoi.player.assets.TranscodeEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackGateStateTest {

    @Test
    fun transcodeUiEvent_runningMapsProgressToPercent() {
        val event = TranscodeUiEvent.from(TranscodeEvent.Running(fileId = 5, progress = 0.42f))
        assertTrue(event is TranscodeUiEvent.Running)
        assertEquals(5, (event as TranscodeUiEvent.Running).fileId)
        assertEquals(0.42f, event.progress, 0.001f)
    }

    @Test
    fun shouldAdvanceOnTranscodeReady_whenSkippedOrAlreadyPlayed() {
        assertTrue(shouldAdvanceOnTranscodeReady(5, bypassLocalTranscodeFileIds = setOf(5), playedDuringCurrentVisitFileIds = emptySet()))
        assertTrue(shouldAdvanceOnTranscodeReady(5, bypassLocalTranscodeFileIds = emptySet(), playedDuringCurrentVisitFileIds = setOf(5)))
        assertFalse(shouldAdvanceOnTranscodeReady(5, emptySet(), emptySet()))
    }

    @Test
    fun playbackGateState_blockedCarriesLabelAndProgress() {
        val gate = PlaybackGateState.Blocked(
            fileId = 12,
            label = "clip.mp4",
            progressPercent = 55
        )
        assertEquals(12, gate.fileId)
        assertEquals("clip.mp4", gate.label)
        assertEquals(55, gate.progressPercent)
    }
}
