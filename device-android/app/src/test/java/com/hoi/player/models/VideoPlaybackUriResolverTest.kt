package com.hoi.player.models

import com.hoi.player.assets.TranscodeStatus
import com.hoi.player.assets.VideoAssetEntry
import com.hoi.player.assets.VideoAssetManifest
import com.hoi.player.assets.VideoAssetStore
import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.Before
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import java.io.File

class VideoPlaybackUriResolverTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var store: VideoAssetStore

    @Before
    fun setUp() {
        store = VideoAssetStore.forTesting(tempFolder.newFolder("video_assets"), Gson())
    }

    @Test
    fun resolveVideoPlaybackUri_prefersTranscodedOverOriginal() {
        val entry = VideoAssetEntry(
            fileId = 53,
            fileUrl = "https://cdn.example.com/53.mp4",
            fileSize = 10L,
            localFileName = "53.mp4",
            transcodedFileName = "53.transcoded.v2.mp4",
            transcodeStatus = TranscodeStatus.READY
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.localFileFor(entry).writeBytes(ByteArray(10))
        store.transcodedFileFor(entry).writeBytes(ByteArray(8))

        val item = playlistItem(fileId = 53)
        val uri = item.resolveVideoPlaybackUri(store)

        assertEquals(store.transcodedFileFor(entry).toURI().toString(), uri)
    }

    @Test
    fun resolveVideoPlaybackUri_prefersOriginalOverRemote() {
        val entry = VideoAssetEntry(
            fileId = 99,
            fileUrl = "https://cdn.example.com/video.mp4",
            fileSize = 10L,
            localFileName = "99.mp4"
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.localFileFor(entry).writeBytes(ByteArray(10))

        val uri = playlistItem(fileId = 99).resolveVideoPlaybackUri(store)

        assertEquals(store.localFileFor(entry).toURI().toString(), uri)
    }

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
    fun resolveVideoPlaybackUri_prefersRemoteWhenBypassLocalTranscode() {
        val entry = VideoAssetEntry(
            fileId = 77,
            fileUrl = "https://cdn.example.com/77.mp4",
            fileSize = 10L,
            localFileName = "77.mp4"
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.localFileFor(entry).writeBytes(ByteArray(10))

        val remoteUrl = "https://cdn.example.com/77.mp4"
        val uri = playlistItem(fileId = 77, fileUrl = remoteUrl).resolveVideoPlaybackUri(
            store,
            VideoPlaybackUriOptions(bypassLocalTranscodeFileIds = setOf(77))
        )

        assertEquals(remoteUrl, uri)
    }

    @Test
    fun resolveVideoPlaybackUri_prefersRemoteWhenTranscodeFailed() {
        val entry = VideoAssetEntry(
            fileId = 88,
            fileUrl = "https://cdn.example.com/88.mp4",
            fileSize = 10L,
            localFileName = "88.mp4",
            transcodeStatus = TranscodeStatus.FAILED
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.localFileFor(entry).writeBytes(ByteArray(10))

        val remoteUrl = "https://cdn.example.com/88.mp4"
        val uri = playlistItem(fileId = 88, fileUrl = remoteUrl).resolveVideoPlaybackUri(store)

        assertEquals(remoteUrl, uri)
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

    private fun playlistItem(
        fileId: Int,
        fileUrl: String = "https://cdn.example.com/video.mp4"
    ): PlaylistItem =
        PlaylistItem(
            id = 1,
            fileId = fileId,
            duration = null,
            displayOrder = 1,
            fileType = "video",
            fileUrl = fileUrl,
            fileSize = null,
            originalName = "video.mp4",
            mimeType = "video/mp4"
        )
}
