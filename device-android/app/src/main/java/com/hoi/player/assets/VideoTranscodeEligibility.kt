package com.hoi.player.assets

fun shouldQueueTranscode(
    uri: String?,
    fileId: Int?,
    localOriginalUri: String?,
    transcodeStatus: TranscodeStatus,
    hasTranscodedReady: Boolean
): Boolean {
    if (fileId == null || uri == null) return false
    if (hasTranscodedReady) return false
    if (localOriginalUri == null) return false
    if (uri.startsWith("file:") && localOriginalUri != uri) return false
    if (!uri.startsWith("file:") && !uri.startsWith("http")) return false
    if (transcodeStatus == TranscodeStatus.RUNNING ||
        transcodeStatus == TranscodeStatus.PENDING ||
        transcodeStatus == TranscodeStatus.READY
    ) {
        return false
    }
    return true
}

fun shouldStartPendingTranscode(
    pendingFileId: Int,
    currentlyPlayingFileId: Int?
): Boolean = pendingFileId != currentlyPlayingFileId

fun recordHighDropWindow(
    consecutiveHighDropWindows: Int,
    dropRateFps: Double,
    highDropRateFps: Double = 5.0
): Int {
    return if (dropRateFps >= highDropRateFps) {
        consecutiveHighDropWindows + 1
    } else {
        0
    }
}

fun shouldTriggerTranscodeAfterDrops(consecutiveHighDropWindows: Int): Boolean =
    consecutiveHighDropWindows >= 2
