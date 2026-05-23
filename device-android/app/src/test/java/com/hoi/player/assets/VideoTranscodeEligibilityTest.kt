package com.hoi.player.assets

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
}
