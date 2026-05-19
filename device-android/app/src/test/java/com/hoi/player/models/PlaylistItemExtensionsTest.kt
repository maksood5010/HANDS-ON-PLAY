package com.hoi.player.models

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistItemExtensionsTest {

    @Test
    fun resolvePlaybackUrl_prefersPlaybackUrlOverFileUrl() {
        val item = PlaylistItem(
            id = 1,
            fileId = 1,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "https://cdn.example.com/video.mp4",
            playbackUrl = "https://cdn.example.com/master.m3u8",
            transcodeStatus = "ready",
            originalName = "v.mp4",
            mimeType = "video/mp4"
        )
        assertEquals("https://cdn.example.com/master.m3u8", item.resolvePlaybackUrl())
    }

    @Test
    fun resolvePlaybackUrl_fallsBackToFileUrl() {
        val item = PlaylistItem(
            id = 1,
            fileId = 1,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "https://cdn.example.com/video.mp4",
            playbackUrl = null,
            transcodeStatus = "pending",
            originalName = "v.mp4",
            mimeType = "video/mp4"
        )
        assertEquals("https://cdn.example.com/video.mp4", item.resolvePlaybackUrl())
    }

    @Test
    fun isVideo_identifiesVideoType() {
        val video = PlaylistItem(
            id = 1, fileId = 1, duration = null, displayOrder = 1,
            fileType = "video", fileUrl = "u", playbackUrl = null,
            transcodeStatus = null, originalName = null, mimeType = null
        )
        val image = video.copy(fileType = "image")
        assertTrue(video.isVideo())
        assertFalse(image.isVideo())
    }
}
