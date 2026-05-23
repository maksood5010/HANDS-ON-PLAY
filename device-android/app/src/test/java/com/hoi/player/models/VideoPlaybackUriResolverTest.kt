package com.hoi.player.models

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class VideoPlaybackUriResolverTest {

    @Test
    fun resolveVideoPlaybackUri_prefersLocalFileWhenReady() {
        val localFile = File.createTempFile("video", ".mp4")
        localFile.deleteOnExit()

        val item = PlaylistItem(
            id = 1,
            fileId = 99,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "https://cdn.example.com/video.mp4",
            fileSize = null,
            originalName = "video.mp4",
            mimeType = "video/mp4"
        )

        val uri = item.resolveVideoPlaybackUri { fileId ->
            if (fileId == 99) localFile else null
        }

        assertEquals(localFile.toURI().toString(), uri)
    }

    @Test
    fun resolveVideoPlaybackUri_fallsBackToRemoteWhenLocalMissing() {
        val item = PlaylistItem(
            id = 1,
            fileId = 99,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "https://cdn.example.com/video.mp4",
            fileSize = null,
            originalName = "video.mp4",
            mimeType = "video/mp4"
        )

        val uri = item.resolveVideoPlaybackUri { _ -> null }

        assertEquals("https://cdn.example.com/video.mp4", uri)
    }
}
