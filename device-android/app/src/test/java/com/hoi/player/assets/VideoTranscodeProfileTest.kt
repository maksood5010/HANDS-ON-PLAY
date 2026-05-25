package com.hoi.player.assets

import androidx.media3.common.MimeTypes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoTranscodeProfileTest {

    @Test
    fun transcodedFileName_includesProfileVersion() {
        assertEquals("42.transcoded.v2.mp4", VideoTranscodeProfile.transcodedFileNameFor(42))
    }

    @Test
    fun alignHeight_roundsDownToMultipleOf16() {
        assertEquals(720, VideoTranscodeProfile.alignHeight(725))
        assertEquals(480, VideoTranscodeProfile.alignHeight(480))
    }

    @Test
    fun computeTargetHeight_neverExceedsSourceOrDisplayOrMax() {
        assertEquals(720, VideoTranscodeProfile.computeTargetHeightPx(1080, 720))
        assertEquals(480, VideoTranscodeProfile.computeTargetHeightPx(360, 1080))
        assertEquals(1088, VideoTranscodeProfile.computeTargetHeightPx(4000, 4000))
    }

    @Test
    fun bitrateForHeight_scalesWithResolution() {
        assertEquals(2_500_000, VideoTranscodeProfile.bitrateForHeight(480))
        assertEquals(5_000_000, VideoTranscodeProfile.bitrateForHeight(720))
        assertEquals(8_000_000, VideoTranscodeProfile.bitrateForHeight(1080))
    }

    @Test
    fun shouldSkipTranscode_whenH264WithinTargetAndBitrate() {
        val source = VideoSourceInfo(
            width = 1280,
            height = 720,
            rotationDegrees = 0,
            mimeType = MimeTypes.VIDEO_H264,
            bitrate = 4_000_000
        )
        assertTrue(VideoTranscodeProfile.shouldSkipTranscode(source, targetHeightPx = 720))
    }

    @Test
    fun shouldSkipTranscode_falseWhenResolutionTooHigh() {
        val source = VideoSourceInfo(
            width = 1920,
            height = 1080,
            rotationDegrees = 0,
            mimeType = MimeTypes.VIDEO_H264,
            bitrate = 4_000_000
        )
        assertFalse(VideoTranscodeProfile.shouldSkipTranscode(source, targetHeightPx = 720))
    }

    @Test
    fun shouldSkipTranscode_falseWhenBitrateUnknown() {
        val source = VideoSourceInfo(
            width = 1280,
            height = 720,
            rotationDegrees = 0,
            mimeType = MimeTypes.VIDEO_H264,
            bitrate = null
        )
        assertFalse(VideoTranscodeProfile.shouldSkipTranscode(source, targetHeightPx = 720))
    }

    @Test
    fun shouldSkipTranscode_falseForNonH264() {
        val source = VideoSourceInfo(
            width = 1280,
            height = 720,
            rotationDegrees = 0,
            mimeType = MimeTypes.VIDEO_H265,
            bitrate = 2_000_000
        )
        assertFalse(VideoTranscodeProfile.shouldSkipTranscode(source, targetHeightPx = 720))
    }
}
