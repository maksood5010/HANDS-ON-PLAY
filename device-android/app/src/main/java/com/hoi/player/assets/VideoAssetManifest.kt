package com.hoi.player.assets

import com.hoi.player.models.Playlist
import com.hoi.player.models.PlaylistItem
import com.hoi.player.models.isVideo

enum class TranscodeStatus {
    NONE,
    PENDING,
    RUNNING,
    READY,
    FAILED
}

data class VideoAssetManifest(
    val playlistId: Int?,
    val videos: List<VideoAssetEntry>
) {
    companion object {
        fun empty(): VideoAssetManifest = VideoAssetManifest(playlistId = null, videos = emptyList())

        fun fromPlaylist(playlist: Playlist?): VideoAssetManifest {
            if (playlist == null) return empty()
            val videos = playlist.items.orEmpty()
                .filter { it.isVideo() && it.fileId != null && !it.fileUrl.isNullOrBlank() }
                .mapNotNull { item -> VideoAssetEntry.fromPlaylistItem(item) }
            return VideoAssetManifest(playlistId = playlist.id, videos = videos)
        }
    }
}

data class VideoAssetEntry(
    val fileId: Int,
    val fileUrl: String,
    val fileSize: Long?,
    val localFileName: String,
    val transcodedFileName: String? = null,
    // Nullable for Gson: older manifests omit this field and Gson sets null via reflection.
    val transcodeStatus: TranscodeStatus? = null
) {
    fun withResolvedDefaults(): VideoAssetEntry =
        copy(transcodeStatus = transcodeStatus ?: TranscodeStatus.NONE)

    fun transcodeStatusOrNone(): TranscodeStatus = transcodeStatus ?: TranscodeStatus.NONE

    companion object {
        fun transcodedFileNameFor(fileId: Int): String =
            VideoTranscodeProfile.transcodedFileNameFor(fileId)

        fun fromPlaylistItem(item: PlaylistItem): VideoAssetEntry? {
            val fileId = item.fileId ?: return null
            val fileUrl = item.fileUrl?.takeIf { it.isNotBlank() } ?: return null
            return VideoAssetEntry(
                fileId = fileId,
                fileUrl = fileUrl,
                fileSize = item.fileSize,
                localFileName = localFileNameFor(fileId, item.mimeType, item.originalName)
            )
        }

        fun localFileNameFor(fileId: Int, mimeType: String?, originalName: String?): String {
            val ext = extensionFrom(mimeType, originalName)
            return "$fileId.$ext"
        }

        private fun extensionFrom(mimeType: String?, originalName: String?): String {
            originalName?.substringAfterLast('.', "")?.takeIf { it.isNotBlank() }?.let { return it }
            return when (mimeType?.lowercase()) {
                "video/mp4" -> "mp4"
                "video/webm" -> "webm"
                "video/quicktime" -> "mov"
                else -> "mp4"
            }
        }
    }
}

data class VideoAssetManifestDiff(
    val removed: List<VideoAssetEntry>,
    val addedOrChanged: List<VideoAssetEntry>
)

fun diffVideoAssetManifest(
    stored: VideoAssetManifest,
    incoming: VideoAssetManifest
): VideoAssetManifestDiff {
    val storedById = stored.videos.associateBy { it.fileId }
    val incomingById = incoming.videos.associateBy { it.fileId }

    val removed = stored.videos.filter { entry ->
        entry.fileId !in incomingById ||
            incomingById[entry.fileId]?.fileUrl != entry.fileUrl
    }

    val addedOrChanged = incoming.videos.filter { entry ->
        val previous = storedById[entry.fileId]
        previous == null || previous.fileUrl != entry.fileUrl || !entry.matchesReadyFile(previous)
    }

    return VideoAssetManifestDiff(removed = removed, addedOrChanged = addedOrChanged)
}

fun mergeTranscodeStateFromStored(
    incoming: VideoAssetManifest,
    stored: VideoAssetManifest
): VideoAssetManifest {
    val storedById = stored.videos.associateBy { it.fileId }
    return incoming.copy(
        videos = incoming.videos.map { entry ->
            val previous = storedById[entry.fileId]?.withResolvedDefaults()
            if (previous != null && previous.fileUrl == entry.fileUrl) {
                entry.withResolvedDefaults().copy(
                    transcodedFileName = previous.transcodedFileName,
                    transcodeStatus = previous.transcodeStatusOrNone()
                )
            } else {
                entry.withResolvedDefaults()
            }
        }
    )
}

fun VideoAssetManifest.withResolvedDefaults(): VideoAssetManifest =
    copy(videos = videos.map { it.withResolvedDefaults() })

private fun VideoAssetEntry.matchesReadyFile(other: VideoAssetEntry): Boolean {
    return fileUrl == other.fileUrl && localFileName == other.localFileName
}
