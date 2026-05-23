package com.hoi.player.assets

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class VideoAssetStoreTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var assetsDir: java.io.File
    private lateinit var store: VideoAssetStore

    @Before
    fun setUp() {
        assetsDir = tempFolder.newFolder("video_assets")
        store = VideoAssetStore.forTesting(assetsDir, Gson())
    }

    @Test
    fun writeAndReadManifest_roundTrips() {
        val manifest = VideoAssetManifest(
            playlistId = 1,
            videos = listOf(
                VideoAssetEntry(5, "https://cdn/5.mp4", 100L, "5.mp4")
            )
        )

        store.writeManifest(manifest)
        val loaded = store.readManifest()

        assertEquals(manifest, loaded)
    }

    @Test
    fun isFileReady_requiresMatchingSizeWhenKnown() {
        val entry = VideoAssetEntry(7, "https://cdn/7.mp4", 10L, "7.mp4")
        val file = store.localFileFor(entry)
        file.writeBytes(ByteArray(10))

        assertTrue(store.isFileReady(file, 10L))
        assertFalse(store.isFileReady(file, 11L))
    }

    @Test
    fun getLocalFileIfReady_returnsNullWhenMissing() {
        store.writeManifest(
            VideoAssetManifest(
                playlistId = 1,
                videos = listOf(VideoAssetEntry(9, "https://cdn/9.mp4", null, "9.mp4"))
            )
        )

        assertNull(store.getLocalFileIfReady(9))
    }

    @Test
    fun deleteFileFor_removesLocalAndPartFiles() {
        val entry = VideoAssetEntry(3, "https://cdn/3.mp4", null, "3.mp4")
        val file = store.localFileFor(entry)
        val part = store.partFileFor(entry)
        file.writeText("data")
        part.writeText("partial")

        store.deleteFileFor(entry)

        assertFalse(file.exists())
        assertFalse(part.exists())
    }
}
