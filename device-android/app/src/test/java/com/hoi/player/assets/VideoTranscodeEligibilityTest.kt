package com.hoi.player.assets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoTranscodeEligibilityTest {

    @Test
    fun shouldQueueTranscode_trueForLocalOriginalNotYetTranscoded() {
        assertTrue(
            shouldQueueTranscode(
                uri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.NONE,
                hasTranscodedReady = false
            )
        )
    }

    @Test
    fun shouldQueueTranscode_trueForRemoteUriWhenLocalFileExists() {
        assertTrue(
            shouldQueueTranscode(
                uri = "https://cdn.example.com/video.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.NONE,
                hasTranscodedReady = false
            )
        )
    }

    @Test
    fun shouldQueueTranscode_falseForRemoteUriWithoutLocalFile() {
        assertFalse(
            shouldQueueTranscode(
                uri = "https://cdn.example.com/video.mp4",
                fileId = 53,
                localOriginalUri = null,
                transcodeStatus = TranscodeStatus.NONE,
                hasTranscodedReady = false
            )
        )
    }

    @Test
    fun shouldQueueTranscode_falseWhenTranscodedAlreadyReady() {
        assertFalse(
            shouldQueueTranscode(
                uri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.NONE,
                hasTranscodedReady = true
            )
        )
    }

    @Test
    fun shouldQueueTranscode_falseWhenAlreadyPendingOrRunning() {
        assertFalse(
            shouldQueueTranscode(
                uri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.PENDING,
                hasTranscodedReady = false
            )
        )
        assertFalse(
            shouldQueueTranscode(
                uri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.RUNNING,
                hasTranscodedReady = false
            )
        )
    }

    @Test
    fun shouldQueueTranscode_falseWhenPlayingTranscodedUri() {
        assertFalse(
            shouldQueueTranscode(
                uri = "file:///data/user/0/com.hoi.player/files/video_assets/53.transcoded.mp4",
                fileId = 53,
                localOriginalUri = "file:///data/user/0/com.hoi.player/files/video_assets/53.mp4",
                transcodeStatus = TranscodeStatus.NONE,
                hasTranscodedReady = false
            )
        )
    }

    @Test
    fun recordHighDropWindow_requiresTwoConsecutiveWindows() {
        assertFalse(shouldTriggerTranscodeAfterDrops(recordHighDropWindow(0, 6.0)))
        assertTrue(shouldTriggerTranscodeAfterDrops(recordHighDropWindow(1, 6.0)))
        assertFalse(shouldTriggerTranscodeAfterDrops(recordHighDropWindow(1, 2.0)))
    }

    @Test
    fun shouldStartPendingTranscode_whenNotCurrentlyPlayingThatFile() {
        assertFalse(shouldStartPendingTranscode(pendingFileId = 53, currentlyPlayingFileId = 53))
        assertTrue(shouldStartPendingTranscode(pendingFileId = 53, currentlyPlayingFileId = 52))
        assertTrue(shouldStartPendingTranscode(pendingFileId = 53, currentlyPlayingFileId = null))
    }

    @Test
    fun selectNextPendingTranscodeFileId_prefersPrepareBlockingFile() {
        val pending = linkedSetOf(53, 52)
        val next = selectNextPendingTranscodeFileId(
            pendingFileIds = pending,
            currentlyPlayingFileId = 52,
            prepareBlockingFileId = 52,
            isPendingAndNotReady = { true }
        )
        assertEquals(52, next)
    }

    @Test
    fun selectNextPendingTranscodeFileId_fallsBackToQueueOrderWithoutPrepareBlock() {
        val pending = linkedSetOf(53, 54)
        val next = selectNextPendingTranscodeFileId(
            pendingFileIds = pending,
            currentlyPlayingFileId = 52,
            prepareBlockingFileId = null,
            isPendingAndNotReady = { true }
        )
        assertEquals(53, next)
    }

    @Test
    fun shouldStartPendingTranscode_allowsPrepareBlockingFileWhilePlaying() {
        assertTrue(
            shouldStartPendingTranscode(
                pendingFileId = 53,
                currentlyPlayingFileId = 53,
                prepareBlockingFileId = 53
            )
        )
        assertFalse(
            shouldStartPendingTranscode(
                pendingFileId = 53,
                currentlyPlayingFileId = 53,
                prepareBlockingFileId = 52
            )
        )
    }
}
