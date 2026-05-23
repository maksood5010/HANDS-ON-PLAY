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
import java.io.File

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
        val transcoded = store.transcodedFileFor(entry)
        val transcodedPart = store.transcodedPartFileFor(entry)
        file.writeText("data")
        part.writeText("partial")
        transcoded.writeText("transcoded")
        transcodedPart.writeText("transcoded-part")

        store.deleteFileFor(entry)

        assertFalse(file.exists())
        assertFalse(part.exists())
        assertFalse(transcoded.exists())
        assertFalse(transcodedPart.exists())
    }

    @Test
    fun updateTranscodeStatus_persistsInManifest() {
        val entry = VideoAssetEntry(11, "https://cdn/11.mp4", null, "11.mp4")
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))

        store.updateTranscodeStatus(11, TranscodeStatus.READY, "11.transcoded.mp4")

        val loaded = store.getEntry(11)
        assertEquals(TranscodeStatus.READY, loaded?.transcodeStatus)
        assertEquals("11.transcoded.mp4", loaded?.transcodedFileName)
    }

    @Test
    fun getTranscodedFileIfReady_requiresReadyStatusAndNonEmptyFile() {
        val entry = VideoAssetEntry(
            fileId = 12,
            fileUrl = "https://cdn/12.mp4",
            fileSize = null,
            localFileName = "12.mp4",
            transcodedFileName = "12.transcoded.mp4",
            transcodeStatus = TranscodeStatus.READY
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.transcodedFileFor(entry).writeBytes(ByteArray(4))

        assertEquals(store.transcodedFileFor(entry), store.getTranscodedFileIfReady(12))
    }

    @Test
    fun resolveFileIdFromLocalPlaybackUri_parsesFileId() {
        val entry = VideoAssetEntry(53, "https://cdn/53.mp4", null, "53.mp4")
        val uri = store.localFileFor(entry).toURI().toString()

        assertEquals(53, store.resolveFileIdFromLocalPlaybackUri(uri))
    }

    @Test
    fun readManifest_migratesLegacyEntriesMissingTranscodeStatus() {
        assetsDir.mkdirs()
        File(assetsDir, "manifest.json").writeText(
            """
            {
              "playlistId": 1,
              "videos": [
                {
                  "fileId": 53,
                  "fileUrl": "https://cdn/53.mp4",
                  "fileSize": 100,
                  "localFileName": "53.mp4"
                }
              ]
            }
            """.trimIndent()
        )

        val loaded = store.readManifest()

        assertEquals(TranscodeStatus.NONE, loaded.videos.single().transcodeStatusOrNone())
    }

    @Test
    fun resetTranscodeState_clearsTranscodedArtifacts() {
        val entry = VideoAssetEntry(
            fileId = 15,
            fileUrl = "https://cdn/15.mp4",
            null,
            "15.mp4",
            transcodedFileName = "15.transcoded.mp4",
            transcodeStatus = TranscodeStatus.READY
        )
        store.writeManifest(VideoAssetManifest(playlistId = 1, videos = listOf(entry)))
        store.transcodedFileFor(entry).writeText("transcoded")

        store.resetTranscodeState(15)

        assertFalse(store.transcodedFileFor(entry).exists())
        assertEquals(TranscodeStatus.NONE, store.getTranscodeStatus(15))
    }
}
