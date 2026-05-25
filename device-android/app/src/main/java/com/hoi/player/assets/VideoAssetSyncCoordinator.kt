package com.hoi.player.assets

import android.util.Log
import com.hoi.player.models.Playlist
import com.hoi.player.models.PlaylistItem
import com.hoi.player.models.isVideo
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VideoAssetSyncCoordinator @Inject constructor(
    private val store: VideoAssetStore,
    private val downloader: VideoAssetDownloader,
    private val exoCacheCleaner: ExoCacheCleaner
) {
    private val syncMutex = Mutex()

    suspend fun sync(playlist: Playlist?) {
        syncMutex.withLock {
            runSync(playlist)
        }
    }

    suspend fun prioritizeDownloads(playlist: Playlist?, currentFileId: Int?) {
        syncMutex.withLock {
            val incoming = VideoAssetManifest.fromPlaylist(playlist)
            val toDownload = incoming.videos.filter { entry ->
                !store.isFileReady(store.localFileFor(entry), entry.fileSize)
            }
            if (toDownload.isEmpty()) return

            val ordered = orderDownloads(toDownload, playlist, currentFileId)
            for (entry in ordered) {
                downloader.download(entry)
            }
        }
    }

    private suspend fun runSync(playlist: Playlist?) {
        val stored = store.readManifest()
        val incoming = VideoAssetManifest.fromPlaylist(playlist)

        if (incoming.videos.isEmpty() && incoming.playlistId == null) {
            cleanupAndPersist(emptyManifest = true, stored = stored, incoming = VideoAssetManifest.empty())
            return
        }

        val diff = diffVideoAssetManifest(stored, incoming)
        Log.d(
            TAG,
            "Sync playlistId=${incoming.playlistId} removed=${diff.removed.size} " +
                "addedOrChanged=${diff.addedOrChanged.size}"
        )

        for (entry in diff.removed) {
            store.deleteFileFor(entry)
            downloader.resetState(entry.fileId)
        }
        exoCacheCleaner.removeEntries(diff.removed)

        val storedById = stored.videos.associateBy { it.fileId }
        for (entry in diff.addedOrChanged) {
            val previous = storedById[entry.fileId]
            if (previous != null && previous.fileUrl != entry.fileUrl) {
                store.resetTranscodeState(entry.fileId)
            }
        }

        val mergedIncoming = mergeTranscodeStateFromStored(incoming, stored)
        val retainedVideos = mergedIncoming.videos.filter { entry ->
            diff.removed.none { it.fileId == entry.fileId }
        }
        val interimManifest = VideoAssetManifest(
            playlistId = mergedIncoming.playlistId,
            videos = retainedVideos
        )
        store.writeManifest(interimManifest)

        val toDownload = mergedIncoming.videos.filter { entry ->
            !store.isFileReady(store.localFileFor(entry), entry.fileSize)
        }

        if (toDownload.isEmpty()) {
            store.writeManifest(mergedIncoming)
            return
        }

        val ordered = orderDownloads(toDownload, playlist, priorityFileId = null)
        for (entry in ordered) {
            downloader.download(entry)
        }

        store.writeManifest(mergedIncoming)
    }

    private fun cleanupAndPersist(
        emptyManifest: Boolean,
        stored: VideoAssetManifest,
        incoming: VideoAssetManifest
    ) {
        if (stored.videos.isNotEmpty()) {
            for (entry in stored.videos) {
                store.deleteFileFor(entry)
                downloader.resetState(entry.fileId)
            }
            exoCacheCleaner.removeEntries(stored.videos)
        }
        if (emptyManifest) {
            store.deleteAllAssets()
        }
        store.writeManifest(incoming)
        downloader.clearStates()
        Log.d(TAG, "Cleared all video assets (empty playlist)")
    }

    private fun orderDownloads(
        entries: List<VideoAssetEntry>,
        playlist: Playlist?,
        priorityFileId: Int?
    ): List<VideoAssetEntry> {
        if (entries.size <= 1) return entries

        val videoFileIds = playlist?.items.orEmpty()
            .filter { it.isVideo() }
            .mapNotNull { it.fileId }

        val entryById = entries.associateBy { it.fileId }
        val ordered = mutableListOf<VideoAssetEntry>()
        val seen = mutableSetOf<Int>()

        fun addIfNeeded(fileId: Int?) {
            if (fileId == null || fileId in seen) return
            entryById[fileId]?.let {
                ordered.add(it)
                seen.add(fileId)
            }
        }

        addIfNeeded(priorityFileId)

        if (priorityFileId != null) {
            val priorityIndex = videoFileIds.indexOf(priorityFileId)
            if (priorityIndex >= 0) {
                for (i in (priorityIndex + 1) until videoFileIds.size) {
                    addIfNeeded(videoFileIds[i])
                }
                for (i in 0 until priorityIndex) {
                    addIfNeeded(videoFileIds[i])
                }
            }
        } else {
            videoFileIds.forEach { addIfNeeded(it) }
        }

        entries.forEach { entry ->
            if (entry.fileId !in seen) {
                ordered.add(entry)
            }
        }

        return ordered
    }

    companion object {
        private const val TAG = "VideoAssetSync"
    }
}
