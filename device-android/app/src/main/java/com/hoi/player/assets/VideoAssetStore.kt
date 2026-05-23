package com.hoi.player.assets

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
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
            gson.fromJson(manifestFile.readText(), VideoAssetManifest::class.java)
                ?: VideoAssetManifest.empty()
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to read manifest; treating as empty", t)
            VideoAssetManifest.empty()
        }
    }

    fun writeManifest(manifest: VideoAssetManifest) {
        assetsDir.mkdirs()
        val temp = File(assetsDir, "$MANIFEST_FILE_NAME.part")
        temp.writeText(gson.toJson(manifest))
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

    fun getLocalFileIfReady(fileId: Int): File? {
        val manifest = readManifest()
        val entry = manifest.videos.find { it.fileId == fileId } ?: return null
        val file = localFileFor(entry)
        return if (isFileReady(file, entry.fileSize)) file else null
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
