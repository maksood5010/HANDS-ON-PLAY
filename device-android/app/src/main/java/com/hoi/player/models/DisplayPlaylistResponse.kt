package com.hoi.player.models

import com.google.gson.annotations.SerializedName

data class DisplayPlaylistResponse(
    val success: Boolean,
    val playlist: Playlist?
)

data class Playlist(
    val id: Int?,
    val name: String?,
    val description: String?,
    val status: String?,
    val items: List<PlaylistItem>?
)

data class PlaylistItem(
    val id: Int?,
    @SerializedName("file_id") val fileId: Int?,
    val duration: Int?,
    @SerializedName("display_order") val displayOrder: Int?,
    @SerializedName("file_type") val fileType: String?,
    @SerializedName("file_url") val fileUrl: String?,
    @SerializedName("original_name") val originalName: String?,
    @SerializedName("mime_type") val mimeType: String?
)
