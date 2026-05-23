package com.hoi.player.assets

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.net.URI
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VideoAssetStore private constructor(
    private val gson: Gson,
    private val resolveAssetsDir: () -> File,
    private val statFsPath: () -> String
) {
    @Inject
    constructor(
        @ApplicationContext context: Context,
        gson: Gson
    ) : this(
        gson = gson,
        resolveAssetsDir = {
            File(context.filesDir, ASSETS_DIR_NAME).also { it.mkdirs() }
        },
        statFsPath = { context.filesDir.absolutePath }
    )

    private val assetsDir: File
        get() = resolveAssetsDir()

    private val manifestFile: File
        get() = File(assetsDir, MANIFEST_FILE_NAME)

    fun readManifest(): VideoAssetManifest {
        if (!manifestFile.exists()) return VideoAssetManifest.empty()
        return try {
            (gson.fromJson(manifestFile.readText(), VideoAssetManifest::class.java)
                ?: VideoAssetManifest.empty())
                .withResolvedDefaults()
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to read manifest; treating as empty", t)
            VideoAssetManifest.empty()
        }
    }

    fun writeManifest(manifest: VideoAssetManifest) {
        assetsDir.mkdirs()
        val normalized = manifest.withResolvedDefaults()
        val temp = File(assetsDir, "$MANIFEST_FILE_NAME.part")
        temp.writeText(gson.toJson(normalized))
        if (manifestFile.exists() && !manifestFile.delete()) {
            Log.w(TAG, "Could not delete old manifest before replace")
        }
        if (!temp.renameTo(manifestFile)) {
            temp.copyTo(manifestFile, overwrite = true)
            temp.delete()
        }
    }

    fun localFileFor(entry: VideoAssetEntry): File =
        File(assetsDir, entry.localFileName)

    fun localFileFor(fileId: Int, localFileName: String): File =
        File(assetsDir, localFileName)

    fun partFileFor(entry: VideoAssetEntry): File =
        File(assetsDir, "${entry.localFileName}.part")

    fun transcodedFileFor(entry: VideoAssetEntry): File {
        val name = entry.transcodedFileName ?: VideoAssetEntry.transcodedFileNameFor(entry.fileId)
        return File(assetsDir, name)
    }

    fun transcodedPartFileFor(entry: VideoAssetEntry): File =
        File(assetsDir, "${transcodedFileFor(entry).name}.part")

    fun getEntry(fileId: Int): VideoAssetEntry? =
        readManifest().videos.find { it.fileId == fileId }

    fun getTranscodeStatus(fileId: Int): TranscodeStatus =
        getEntry(fileId)?.transcodeStatusOrNone() ?: TranscodeStatus.NONE

    fun getTranscodedFileIfReady(fileId: Int): File? {
        val entry = getEntry(fileId)?.withResolvedDefaults() ?: return null
        val file = transcodedFileFor(entry)
        if (!file.exists() || !file.isFile || file.length() <= 0) return null
        if (entry.transcodeStatusOrNone() != TranscodeStatus.READY) {
            updateTranscodeStatus(
                fileId,
                TranscodeStatus.READY,
                entry.transcodedFileName ?: VideoAssetEntry.transcodedFileNameFor(fileId)
            )
        }
        return file
    }

    fun getLocalOriginalUri(fileId: Int): String? =
        getLocalFileIfReady(fileId)?.toURI()?.toString()

    fun resolveFileIdFromLocalPlaybackUri(uri: String): Int? {
        if (!uri.startsWith("file:")) return null
        return try {
            val path = URI(uri).path ?: return null
            File(path).name.substringBefore('.').toIntOrNull()
        } catch (_: Throwable) {
            null
        }
    }

    /** Maps the URI ExoPlayer is playing (local file or remote URL) to a manifest fileId. */
    fun resolveFileIdFromPlaybackUri(uri: String): Int? {
        resolveFileIdFromLocalPlaybackUri(uri)?.let { return it }
        if (!uri.startsWith("http")) return null
        val manifest = readManifest()
        return manifest.videos.find { entry -> entry.fileUrl == uri }?.fileId
    }

    fun updateTranscodeStatus(
        fileId: Int,
        status: TranscodeStatus,
        transcodedFileName: String? = null
    ) {
        val manifest = readManifest()
        val updatedVideos = manifest.videos.map { entry ->
            if (entry.fileId != fileId) entry
            else entry.copy(
                transcodeStatus = status,
                transcodedFileName = transcodedFileName ?: entry.transcodedFileName
            )
        }
        writeManifest(manifest.copy(videos = updatedVideos))
    }

    fun getLocalFileIfReady(fileId: Int): File? {
        val manifest = readManifest()
        val entry = manifest.videos.find { it.fileId == fileId }
        if (entry != null) {
            val file = localFileFor(entry)
            if (isFileReady(file, entry.fileSize)) return file
        }
        return findDownloadedOriginalOnDisk(fileId)
    }

    /** Fallback when manifest is mid-update but the downloaded file is already on disk. */
    private fun findDownloadedOriginalOnDisk(fileId: Int): File? {
        val dir = assetsDir
        if (!dir.isDirectory) return null
        return dir.listFiles()?.firstOrNull { candidate ->
            candidate.isFile &&
                !candidate.name.endsWith(".part") &&
                !candidate.name.contains(".transcoded.") &&
                candidate.name.startsWith("$fileId.")
        }?.takeIf { it.length() > 0 }
    }

    fun isFileReady(file: File, expectedSize: Long?): Boolean {
        if (!file.exists() || !file.isFile) return false
        if (expectedSize != null && expectedSize > 0 && file.length() != expectedSize) {
            return false
        }
        return file.length() > 0
    }

    fun deleteFileFor(entry: VideoAssetEntry) {
        localFileFor(entry).delete()
        partFileFor(entry).delete()
        transcodedFileFor(entry).delete()
        transcodedPartFileFor(entry).delete()
    }

    fun deleteTranscodedFileFor(entry: VideoAssetEntry) {
        transcodedFileFor(entry).delete()
        transcodedPartFileFor(entry).delete()
    }

    fun resetTranscodeState(fileId: Int) {
        val entry = getEntry(fileId) ?: return
        deleteTranscodedFileFor(entry)
        val manifest = readManifest()
        val updatedVideos = manifest.videos.map { video ->
            if (video.fileId != fileId) video
            else video.copy(transcodeStatus = TranscodeStatus.NONE, transcodedFileName = null)
        }
        writeManifest(manifest.copy(videos = updatedVideos))
    }

    fun deleteAllAssets() {
        assetsDir.listFiles()?.forEach { file ->
            if (file.name != MANIFEST_FILE_NAME) {
                file.delete()
            }
        }
    }

    fun hasCriticalLowSpace(requiredBytes: Long = MIN_FREE_BYTES): Boolean {
        return try {
            val stat = StatFs(statFsPath())
            stat.availableBytes < requiredBytes
        } catch (t: Throwable) {
            Log.w(TAG, "Could not check free space", t)
            false
        }
    }

    companion object {
        fun forTesting(assetsDir: File, gson: Gson = Gson()): VideoAssetStore {
            val root = assetsDir.also { it.mkdirs() }
            return VideoAssetStore(
                gson = gson,
                resolveAssetsDir = { root },
                statFsPath = { root.absolutePath }
            )
        }

        private const val TAG = "VideoAssetSync"
        private const val ASSETS_DIR_NAME = "video_assets"
        private const val MANIFEST_FILE_NAME = "manifest.json"
        private const val MIN_FREE_BYTES = 50L * 1024 * 1024
    }
}
