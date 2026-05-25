package com.hoi.player.assets

import com.hoi.player.models.Playlist
import com.hoi.player.models.PlaylistItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoAssetManifestDiffTest {

    private val entryA = VideoAssetEntry(1, "https://cdn/a.mp4", 1000L, "1.mp4")
    private val entryB = VideoAssetEntry(2, "https://cdn/b.mp4", 2000L, "2.mp4")
    private val entryC = VideoAssetEntry(3, "https://cdn/c.mp4", 3000L, "3.mp4")

    @Test
    fun diff_detectsRemovedVideoOnSamePlaylist() {
        val stored = VideoAssetManifest(playlistId = 10, videos = listOf(entryA, entryB))
        val incoming = VideoAssetManifest(playlistId = 10, videos = listOf(entryA))

        val diff = diffVideoAssetManifest(stored, incoming)

        assertEquals(listOf(entryB), diff.removed)
        assertTrue(diff.addedOrChanged.isEmpty())
    }

    @Test
    fun diff_detectsAddedVideoOnSamePlaylist() {
        val stored = VideoAssetManifest(playlistId = 10, videos = listOf(entryA))
        val incoming = VideoAssetManifest(playlistId = 10, videos = listOf(entryA, entryC))

        val diff = diffVideoAssetManifest(stored, incoming)

        assertTrue(diff.removed.isEmpty())
        assertEquals(listOf(entryC), diff.addedOrChanged)
    }

    @Test
    fun diff_detectsReplacedUrlForSameFileId() {
        val stored = VideoAssetManifest(playlistId = 10, videos = listOf(entryA))
        val replaced = entryA.copy(fileUrl = "https://cdn/a-v2.mp4")
        val incoming = VideoAssetManifest(playlistId = 10, videos = listOf(replaced))

        val diff = diffVideoAssetManifest(stored, incoming)

        assertEquals(listOf(entryA), diff.removed)
        assertEquals(listOf(replaced), diff.addedOrChanged)
    }

    @Test
    fun diff_playlistIdChangeMarksOldVideosForRemoval() {
        val stored = VideoAssetManifest(playlistId = 10, videos = listOf(entryA, entryB))
        val incoming = VideoAssetManifest(playlistId = 20, videos = listOf(entryC))

        val diff = diffVideoAssetManifest(stored, incoming)

        assertEquals(listOf(entryA, entryB), diff.removed)
        assertEquals(listOf(entryC), diff.addedOrChanged)
    }

    @Test
    fun fromPlaylist_includesVideosOnly() {
        val playlist = Playlist(
            id = 5,
            name = "Test",
            description = null,
            status = "active",
            items = listOf(
                videoItem(fileId = 1, url = "https://cdn/v.mp4"),
                imageItem(fileId = 2, url = "https://cdn/i.jpg")
            )
        )

        val manifest = VideoAssetManifest.fromPlaylist(playlist)

        assertEquals(5, manifest.playlistId)
        assertEquals(1, manifest.videos.size)
        assertEquals(1, manifest.videos.first().fileId)
    }

    @Test
    fun localFileName_usesExtensionFromOriginalName() {
        assertEquals("42.mp4", VideoAssetEntry.localFileNameFor(42, "video/mp4", "clip.mp4"))
        assertEquals("42.webm", VideoAssetEntry.localFileNameFor(42, "video/webm", null))
    }

    private fun videoItem(fileId: Int, url: String) = PlaylistItem(
        id = fileId,
        fileId = fileId,
        duration = null,
        displayOrder = 1,
        fileType = "video",
        fileUrl = url,
        fileSize = 100L,
        originalName = "v.mp4",
        mimeType = "video/mp4"
    )

    private fun imageItem(fileId: Int, url: String) = PlaylistItem(
        id = fileId,
        fileId = fileId,
        duration = 5,
        displayOrder = 2,
        fileType = "image",
        fileUrl = url,
        fileSize = 50L,
        originalName = "i.jpg",
        mimeType = "image/jpeg"
    )
}
