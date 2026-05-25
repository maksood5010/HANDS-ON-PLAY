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

    fun started(
        fileId: Int,
        sourceFileName: String,
        targetHeightPx: Int,
        videoBitrate: Int,
        sourceHeightPx: Int
    ) {
        val mbps = videoBitrate / 1_000_000.0
        Log.i(
            TAG,
            "Conversion started for file $fileId ($sourceFileName): " +
                "source ${sourceHeightPx}p -> ${targetHeightPx}p @ ${"%.1f".format(mbps)} Mbps"
        )
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

    /** Verbose diagnostics for stuck-at-0% investigations (filter logcat: VideoTranscode). */
    fun debug(message: String) {
        Log.i(TAG, "[debug] $message")
    }

    fun debug(fileId: Int, message: String) {
        Log.i(TAG, "[debug] file $fileId: $message")
    }

    fun coordinator(
        phase: String,
        fileId: Int? = null,
        detail: String? = null
    ) {
        val idPart = fileId?.let { " file=$it" } ?: ""
        val detailPart = detail?.let { " | $it" } ?: ""
        Log.i(TAG, "[coordinator] $phase$idPart$detailPart")
    }

    fun transformer(
        phase: String,
        fileId: Int? = null,
        detail: String? = null
    ) {
        val idPart = fileId?.let { " file=$it" } ?: ""
        val detailPart = detail?.let { " | $it" } ?: ""
        Log.i(TAG, "[transformer] $phase$idPart$detailPart")
    }

    fun progressPoll(
        fileId: Int?,
        progressState: String,
        progressPercent: Int?,
        partBytes: Long,
        inputBytes: Long,
        elapsedMs: Long,
        preferSoftwareDecoder: Boolean
    ) {
        val idPart = fileId?.let { "file $it" } ?: "file ?"
        val percentPart = progressPercent?.let { " progress=$it%" } ?: ""
        Log.i(
            TAG,
            "[progress] $idPart | state=$progressState$percentPart | part=${sizeLabel(partBytes)} " +
                "input=${sizeLabel(inputBytes)} | elapsed=${elapsedMs}ms | swDecoder=$preferSoftwareDecoder"
        )
    }

    fun progressStallWarning(
        fileId: Int?,
        progressState: String,
        partBytes: Long,
        elapsedMs: Long,
        pollCount: Int
    ) {
        val idPart = fileId?.let { "file $it" } ?: "file ?"
        Log.w(
            TAG,
            "[stall] $idPart still at 0% | state=$progressState | part=${sizeLabel(partBytes)} | " +
                "elapsed=${elapsedMs}ms | polls=$pollCount — export may be hung"
        )
    }

    fun transformerExportError(
        fileId: Int?,
        errorCode: Int,
        message: String?,
        preferSoftwareDecoder: Boolean,
        cause: Throwable? = null
    ) {
        val idPart = fileId?.let { "file $it" } ?: "file ?"
        val text =
            "[transformer] export failed $idPart | code=$errorCode | swDecoder=$preferSoftwareDecoder | msg=$message"
        if (cause != null) {
            Log.e(TAG, text, cause)
        } else {
            Log.e(TAG, text)
        }
    }

    fun formatSize(bytes: Long): String = sizeLabel(bytes)

    private fun sizeLabel(bytes: Long): String {
        if (bytes < 1024) return "${bytes}B"
        val kb = bytes / 1024.0
        if (kb < 1024) return "${"%.1f".format(kb)}KB"
        return "${"%.1f".format(kb / 1024.0)}MB"
    }
}
