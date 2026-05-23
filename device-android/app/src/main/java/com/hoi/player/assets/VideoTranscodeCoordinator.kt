package com.hoi.player.assets

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

@Singleton
class VideoTranscodeCoordinator @Inject constructor(
    private val store: VideoAssetStore,
    private val transcoder: VideoTranscoder
) {
    private val transcodeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val stateMutex = Mutex()
    private val _events = MutableSharedFlow<TranscodeEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<TranscodeEvent> = _events.asSharedFlow()

    private var currentlyPlayingFileId: Int? = null
    private var activeTranscodeFileId: Int? = null
    private val dropWindowsByFileId = mutableMapOf<Int, Int>()
    private val lastQueuedAtMsByFileId = mutableMapOf<Int, Long>()
    private val retriedFileIds = mutableSetOf<Int>()
    private val pendingFileIds = LinkedHashSet<Int>()
    private val skipReasonLoggedKeys = mutableSetOf<String>()

    init {
        transcodeScope.launch {
            recoverInterruptedTranscodes()
        }
    }

    fun onFrameDrop(uri: String, dropRateFps: Double) {
        transcodeScope.launch {
            handleFrameDrop(uri, dropRateFps)
        }
    }

    suspend fun setCurrentlyPlayingFileId(fileId: Int?) {
        currentlyPlayingFileId = fileId
        if (fileId != null) {
            tryStartPendingJobs(excludeFileId = fileId)
        }
    }

    suspend fun notifyPlaybackIdle(previousFileId: Int?) {
        if (previousFileId != null && currentlyPlayingFileId == previousFileId) {
            currentlyPlayingFileId = null
        }
        tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
    }

    private suspend fun recoverInterruptedTranscodes() {
        val manifest = store.readManifest()
        manifest.videos.forEach { entry ->
            when (entry.transcodeStatusOrNone()) {
                TranscodeStatus.RUNNING -> {
                    store.updateTranscodeStatus(entry.fileId, TranscodeStatus.PENDING)
                    stateMutex.withLock { pendingFileIds.add(entry.fileId) }
                }
                TranscodeStatus.PENDING -> {
                    if (store.getTranscodedFileIfReady(entry.fileId) == null) {
                        stateMutex.withLock { pendingFileIds.add(entry.fileId) }
                    }
                }
                TranscodeStatus.FAILED -> {
                    if (store.getTranscodedFileIfReady(entry.fileId) == null) {
                        store.updateTranscodeStatus(entry.fileId, TranscodeStatus.NONE)
                        retriedFileIds.remove(entry.fileId)
                    }
                }
                else -> Unit
            }
        }
        tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
    }

    private suspend fun handleFrameDrop(uri: String, dropRateFps: Double) {
        val fileId = store.resolveFileIdFromPlaybackUri(uri)
        if (fileId == null) {
            logSkipOnce("unknown-uri", null, "video not in local manifest")
            return
        }
        val consecutive = recordHighDropWindow(dropWindowsByFileId[fileId] ?: 0, dropRateFps)
        dropWindowsByFileId[fileId] = consecutive
        if (!shouldTriggerTranscodeAfterDrops(consecutive)) return

        dropWindowsByFileId[fileId] = 0

        if (store.getTranscodedFileIfReady(fileId) != null) {
            logSkipOnce("ready-$fileId", fileId, "converted file already available")
            return
        }

        val status = store.getTranscodeStatus(fileId)
        if (status == TranscodeStatus.PENDING) {
            resumePendingTranscode(fileId)
            return
        }

        val lastQueued = lastQueuedAtMsByFileId[fileId] ?: 0L
        if (status != TranscodeStatus.FAILED &&
            System.currentTimeMillis() - lastQueued < QUEUE_COOLDOWN_MS
        ) {
            logSkipOnce("cooldown-$fileId", fileId, "cooldown active")
            return
        }

        val localOriginalUri = store.getLocalOriginalUri(fileId)
        val hasTranscodedReady = false
        if (!shouldQueueTranscode(uri, fileId, localOriginalUri, status, hasTranscodedReady)) {
            val reason = when {
                localOriginalUri == null -> "waiting for download to finish"
                uri.startsWith("http") -> "will convert after local file is used"
                else -> "not eligible (status=$status)"
            }
            logSkipOnce("ineligible-$fileId-$status", fileId, reason)
            return
        }

        if (status == TranscodeStatus.FAILED) {
            retriedFileIds.remove(fileId)
        }

        queueTranscode(fileId)
    }

    private suspend fun resumePendingTranscode(fileId: Int) {
        stateMutex.withLock { pendingFileIds.add(fileId) }
        tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
    }

    private suspend fun queueTranscode(fileId: Int) {
        if (store.getTranscodedFileIfReady(fileId) != null) return

        var emitQueued = false
        val shouldStart = stateMutex.withLock {
            val status = store.getTranscodeStatus(fileId)
            when {
                status == TranscodeStatus.RUNNING || status == TranscodeStatus.READY -> false
                status == TranscodeStatus.PENDING -> {
                    pendingFileIds.add(fileId)
                    true
                }
                else -> {
                    store.updateTranscodeStatus(fileId, TranscodeStatus.PENDING)
                    pendingFileIds.add(fileId)
                    lastQueuedAtMsByFileId[fileId] = System.currentTimeMillis()
                    emitQueued = true
                    true
                }
            }
        }
        if (emitQueued) {
            VideoTranscodeLog.queued(fileId)
            _events.emit(TranscodeEvent.Queued(fileId))
        }
        if (shouldStart) {
            tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
        }
    }

    private suspend fun tryStartPendingJobs(excludeFileId: Int?) {
        val fileIdToRun = stateMutex.withLock {
            if (activeTranscodeFileId != null) return@withLock null
            pendingFileIds.removeAll { candidate ->
                store.getTranscodedFileIfReady(candidate) != null
            }
            val nextFileId = pendingFileIds.firstOrNull { candidate ->
                shouldStartPendingTranscode(candidate, excludeFileId) &&
                    store.getTranscodeStatus(candidate) == TranscodeStatus.PENDING &&
                    store.getTranscodedFileIfReady(candidate) == null
            } ?: return@withLock null
            pendingFileIds.remove(nextFileId)
            activeTranscodeFileId = nextFileId
            nextFileId
        } ?: return

        transcodeScope.launch {
            runTranscodeJob(fileIdToRun)
        }
    }

    private suspend fun runTranscodeJob(fileId: Int) {
        var lastLoggedPercent = -1
        try {
            if (store.getTranscodedFileIfReady(fileId) != null) {
                _events.emit(TranscodeEvent.Ready(fileId))
                return
            }

            val entry = store.getEntry(fileId)
            if (entry == null) {
                VideoTranscodeLog.error(fileId, "manifest entry missing")
                _events.emit(TranscodeEvent.Failed(fileId))
                return
            }

            val input = store.getLocalFileIfReady(fileId)
            if (input == null) {
                VideoTranscodeLog.error(fileId, "original video not downloaded yet")
                store.updateTranscodeStatus(fileId, TranscodeStatus.FAILED)
                _events.emit(TranscodeEvent.Failed(fileId))
                return
            }

            if (store.hasCriticalLowSpace(requiredBytes = input.length())) {
                VideoTranscodeLog.error(fileId, "not enough storage space")
                store.updateTranscodeStatus(fileId, TranscodeStatus.FAILED)
                _events.emit(TranscodeEvent.Failed(fileId))
                return
            }

            val outputName = VideoAssetEntry.transcodedFileNameFor(fileId)
            store.updateTranscodeStatus(fileId, TranscodeStatus.RUNNING, outputName)
            _events.emit(TranscodeEvent.Running(fileId, progress = 0f))

            val output = store.transcodedFileFor(entry.copy(transcodedFileName = outputName))
            VideoTranscodeLog.started(fileId, input.name)
            VideoTranscodeLog.progress(fileId, 0)

            withContext(NonCancellable) {
                transcoder.transcode(input, output) { progress ->
                    val percent = (progress * 100).toInt().coerceIn(0, 100)
                    if (percent >= lastLoggedPercent + 10 || percent == 100) {
                        lastLoggedPercent = percent
                        VideoTranscodeLog.progress(fileId, percent)
                    }
                    _events.emit(TranscodeEvent.Running(fileId, progress))
                }
            }
            store.updateTranscodeStatus(fileId, TranscodeStatus.READY, outputName)
            _events.emit(TranscodeEvent.Ready(fileId))
            VideoTranscodeLog.completed(fileId, output.name, output.length())
        } catch (t: Throwable) {
            VideoTranscodeLog.error(fileId, t.message ?: "conversion failed", t)
            val entry = store.getEntry(fileId)
            if (entry != null) {
                store.transcodedFileFor(
                    entry.copy(transcodedFileName = VideoAssetEntry.transcodedFileNameFor(fileId))
                ).delete()
            }
            if (retriedFileIds.add(fileId)) {
                store.updateTranscodeStatus(fileId, TranscodeStatus.PENDING)
                stateMutex.withLock {
                    pendingFileIds.add(fileId)
                }
                VideoTranscodeLog.queued(fileId)
            } else {
                store.updateTranscodeStatus(
                    fileId,
                    TranscodeStatus.FAILED,
                    VideoAssetEntry.transcodedFileNameFor(fileId)
                )
            }
            _events.emit(TranscodeEvent.Failed(fileId))
        } finally {
            stateMutex.withLock {
                activeTranscodeFileId = null
            }
            tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
        }
    }

    private fun logSkipOnce(key: String, fileId: Int?, reason: String) {
        if (skipReasonLoggedKeys.add(key)) {
            VideoTranscodeLog.skipped(fileId, reason)
        }
    }

    companion object {
        private const val QUEUE_COOLDOWN_MS = 10 * 60 * 1000L
    }
}
