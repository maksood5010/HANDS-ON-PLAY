package com.hoi.player.assets

import android.util.Log

/** Single place for human-readable transcode / conversion logs (filter logcat with tag:VideoTranscode). */
object VideoTranscodeLog {
    private const val TAG = "VideoTranscode"

    fun queued(fileId: Int) {
        Log.i(TAG, "Conversion queued for file $fileId")
    }

    fun skipped(fileId: Int?, reason: String) {
        val suffix = fileId?.let { " for file $it" } ?: ""
        Log.i(TAG, "Conversion skipped$suffix: $reason")
    }

    fun started(fileId: Int, sourceFileName: String) {
        Log.i(TAG, "Conversion started for file $fileId ($sourceFileName)")
    }

    fun progress(fileId: Int, percent: Int) {
        Log.i(TAG, "Conversion progress for file $fileId: $percent%")
    }

    fun completed(fileId: Int, outputFileName: String, outputSizeBytes: Long) {
        Log.i(TAG, "Conversion completed for file $fileId -> $outputFileName (${sizeLabel(outputSizeBytes)})")
    }

    fun error(fileId: Int, reason: String, cause: Throwable? = null) {
        if (cause != null) {
            Log.e(TAG, "Conversion error for file $fileId: $reason", cause)
        } else {
            Log.e(TAG, "Conversion error for file $fileId: $reason")
        }
    }

    fun cancelled(fileId: Int) {
        Log.w(TAG, "Conversion cancelled for file $fileId")
    }

    fun usingConvertedFile(fileId: Int) {
        Log.i(TAG, "Playback switched to converted file for $fileId")
    }

    private fun sizeLabel(bytes: Long): String {
        if (bytes < 1024) return "${bytes}B"
        val kb = bytes / 1024.0
        if (kb < 1024) return "${"%.1f".format(kb)}KB"
        return "${"%.1f".format(kb / 1024.0)}MB"
    }
}
