package com.hoi.player.models

/** Stream URL from API (original uploaded file). */
fun PlaylistItem.resolvePlaybackUrl(): String? =
    fileUrl?.takeIf { it.isNotBlank() }

fun PlaylistItem.isVideo(): Boolean =
    fileType.equals("video", ignoreCase = true)
