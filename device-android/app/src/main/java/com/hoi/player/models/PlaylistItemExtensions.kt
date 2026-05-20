package com.hoi.player.models

/** Preferred stream URL from API (HLS when ready), falling back to original file URL. */
fun PlaylistItem.resolvePlaybackUrl(): String? =
    playbackUrl?.takeIf { it.isNotBlank() } ?: fileUrl?.takeIf { it.isNotBlank() }

fun PlaylistItem.isVideo(): Boolean =
    fileType.equals("video", ignoreCase = true)
