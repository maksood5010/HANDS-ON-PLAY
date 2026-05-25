package com.hoi.player.update

import android.util.Log
import com.hoi.player.network.MediaDownloadClient
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApkDownloader @Inject constructor(
    @MediaDownloadClient private val okHttpClient: OkHttpClient
) {
    fun download(
        url: String,
        destination: File,
        onProgress: (percent: Int) -> Unit
    ) {
        val request = Request.Builder().url(url).get().build()
        okHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}")
            }
            val body = response.body ?: throw IOException("Empty response body")
            val totalBytes = body.contentLength()
            destination.parentFile?.mkdirs()
            destination.outputStream().use { output ->
                body.byteStream().use { input ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var downloaded = 0L
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        downloaded += read
                        if (totalBytes > 0L) {
                            val percent = ((downloaded * 100) / totalBytes).toInt().coerceIn(0, 100)
                            onProgress(percent)
                        }
                    }
                }
            }
            onProgress(100)
            Log.i(TAG, "download complete: ${destination.absolutePath} (${destination.length()} bytes)")
        }
    }

    companion object {
        private const val TAG = "ApkDownloader"
    }
}
