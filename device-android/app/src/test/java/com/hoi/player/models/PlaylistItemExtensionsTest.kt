package com.hoi.player.models

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistItemExtensionsTest {

    @Test
    fun resolvePlaybackUrl_returnsFileUrl() {
        val item = PlaylistItem(
            id = 1,
            fileId = 1,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "https://cdn.example.com/video.mp4",
            fileSize = null,
            originalName = "v.mp4",
            mimeType = "video/mp4"
        )
        assertEquals("https://cdn.example.com/video.mp4", item.resolvePlaybackUrl())
    }

    @Test
    fun resolvePlaybackUrl_returnsNullWhenFileUrlBlank() {
        val item = PlaylistItem(
            id = 1,
            fileId = 1,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = "",
            fileSize = null,
            originalName = "v.mp4",
            mimeType = "video/mp4"
        )
        assertEquals(null, item.resolvePlaybackUrl())
    }

    @Test
    fun isVideo_identifiesVideoType() {
        val video = PlaylistItem(
            id = 1, fileId = 1, duration = null, displayOrder = 1,
            fileType = "video", fileUrl = "u", fileSize = null,
            originalName = null, mimeType = null
        )
        val image = video.copy(fileType = "image")
        assertTrue(video.isVideo())
        assertFalse(image.isVideo())
    }
}
