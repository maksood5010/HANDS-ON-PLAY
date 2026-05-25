package com.hoi.player.assets

import android.util.Log
import com.hoi.player.network.MediaDownloadClient
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

enum class VideoDownloadState {
    Pending,
    Downloading,
    Ready,
    Failed
}

@Singleton
class VideoAssetDownloader @Inject constructor(
    @MediaDownloadClient private val okHttpClient: OkHttpClient,
    private val store: VideoAssetStore
) {
    private val states = ConcurrentHashMap<Int, VideoDownloadState>()
    private val queueMutex = Mutex()

    fun getState(fileId: Int): VideoDownloadState =
        states[fileId] ?: VideoDownloadState.Pending

    suspend fun download(entry: VideoAssetEntry) {
        if (store.isFileReady(store.localFileFor(entry), entry.fileSize)) {
            states[entry.fileId] = VideoDownloadState.Ready
            return
        }

        queueMutex.withLock {
            if (getState(entry.fileId) == VideoDownloadState.Downloading) return
            states[entry.fileId] = VideoDownloadState.Downloading
        }

        val destination = store.localFileFor(entry)
        val partFile = store.partFileFor(entry)

        try {
            if (store.hasCriticalLowSpace()) {
                Log.w(TAG, "Skipping download due to low storage fileId=${entry.fileId}")
                states[entry.fileId] = VideoDownloadState.Failed
                return
            }

            partFile.parentFile?.mkdirs()
            if (partFile.exists()) partFile.delete()

            val request = Request.Builder()
                .url(entry.fileUrl)
                .header("Accept", "*/*")
                .build()

            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IOException("HTTP ${response.code}")
                }

                val contentType = response.header("Content-Type").orEmpty()
                if (contentType.contains("text/html", ignoreCase = true) ||
                    contentType.contains("application/xml", ignoreCase = true) ||
                    contentType.contains("application/json", ignoreCase = true)
                ) {
                    throw IOException("Unexpected Content-Type: $contentType")
                }

                val body = response.body ?: throw IOException("Empty response body")
                body.byteStream().use { input ->
                    partFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            }

            validateDownloadedFile(partFile, entry.fileSize)

            if (destination.exists() && !destination.delete()) {
                Log.w(TAG, "Could not delete existing file before replace fileId=${entry.fileId}")
            }
            if (!partFile.renameTo(destination)) {
                partFile.copyTo(destination, overwrite = true)
                partFile.delete()
            }

            states[entry.fileId] = VideoDownloadState.Ready
            Log.d(TAG, "Downloaded fileId=${entry.fileId} path=${destination.absolutePath}")
        } catch (t: Throwable) {
            partFile.delete()
            states[entry.fileId] = VideoDownloadState.Failed
            Log.w(TAG, "Download failed fileId=${entry.fileId} url=${entry.fileUrl}", t)
        }
    }

    private fun validateDownloadedFile(partFile: java.io.File, expectedSize: Long?) {
        val actualSize = partFile.length()
        if (actualSize <= MIN_VALID_VIDEO_BYTES) {
            throw IOException(
                "Downloaded file too small (${actualSize} bytes); likely not a video"
            )
        }
        if (expectedSize != null && expectedSize > 0 && actualSize != expectedSize) {
            throw IOException(
                "Size mismatch expected=$expectedSize actual=$actualSize"
            )
        }
    }

    fun resetState(fileId: Int) {
        states.remove(fileId)
    }

    fun clearStates() {
        states.clear()
    }

    companion object {
        private const val TAG = "VideoAssetSync"
        private const val MIN_VALID_VIDEO_BYTES = 10_240L
    }
}
