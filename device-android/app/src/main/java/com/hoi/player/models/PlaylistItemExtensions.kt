package com.hoi.player.models

import com.hoi.player.assets.VideoAssetStore

/** Local file URI when downloaded and ready; otherwise remote stream URL. */
fun PlaylistItem.resolveVideoPlaybackUri(store: VideoAssetStore): String? {
    val remote = resolvePlaybackUrl() ?: return null
    fileId?.let { id ->
        store.getTranscodedFileIfReady(id)?.let { return it.toURI().toString() }
        store.getLocalFileIfReady(id)?.let { return it.toURI().toString() }
    }
    return remote
}

/** Stream URL from API (original uploaded file). */
fun PlaylistItem.resolvePlaybackUrl(): String? =
    fileUrl?.takeIf { it.isNotBlank() }

fun PlaylistItem.resolveVideoPlaybackUri(getLocalFile: (fileId: Int) -> java.io.File?): String? {
    val remote = resolvePlaybackUrl() ?: return null
    val local = fileId?.let(getLocalFile)
    return local?.toURI()?.toString() ?: remote
}

fun PlaylistItem.isVideo(): Boolean =
    fileType.equals("video", ignoreCase = true)
