package com.hoi.player.assets

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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
    private var activeTranscodeJob: Job? = null
    private var prepareBlockingFileId: Int? = null
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

    suspend fun requestPrepareTranscode(fileId: Int): PrepareTranscodeResult {
        VideoTranscodeLog.coordinator("requestPrepareTranscode", fileId)
        if (store.getTranscodedFileIfReady(fileId) != null) {
            VideoTranscodeLog.coordinator("requestPrepareTranscode", fileId, "already ready")
            return PrepareTranscodeResult.AlreadyReady
        }
        val local = store.getLocalFileIfReady(fileId) ?: run {
            VideoTranscodeLog.coordinator("requestPrepareTranscode", fileId, "local file not ready")
            return PrepareTranscodeResult.NotReady
        }
        if (transcoder.shouldSkipTranscode(local)) {
            VideoTranscodeLog.coordinator("requestPrepareTranscode", fileId, "skip — source within limits")
            store.updateTranscodeStatus(fileId, TranscodeStatus.NONE)
            return PrepareTranscodeResult.Skipped
        }
        stateMutex.withLock {
            prepareBlockingFileId = fileId
        }
        VideoTranscodeLog.coordinator("requestPrepareTranscode", fileId, "queued prepare-blocking job")
        queueTranscode(fileId)
        stateMutex.withLock { movePendingFileToFront(fileId) }
        preemptActiveTranscodeForPrepareBlocking()
        tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
        return PrepareTranscodeResult.Started
    }

    suspend fun cancelPrepare(fileId: Int) {
        stateMutex.withLock {
            if (prepareBlockingFileId == fileId) {
                prepareBlockingFileId = null
            }
            pendingFileIds.remove(fileId)
        }
        if (activeTranscodeFileId == fileId) {
            activeTranscodeJob?.cancel()
        }
    }

    suspend fun skipPrepareTranscode(fileId: Int) {
        stateMutex.withLock {
            if (prepareBlockingFileId == fileId) {
                prepareBlockingFileId = null
            }
            pendingFileIds.remove(fileId)
            retriedFileIds.remove(fileId)
        }
        if (activeTranscodeFileId == fileId) {
            activeTranscodeJob?.cancel()
        }
        store.resetTranscodeState(fileId)
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
        if (store.getTranscodedFileIfReady(fileId) != null) {
            VideoTranscodeLog.coordinator("queueTranscode", fileId, "skipped — already ready")
            return
        }

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
        VideoTranscodeLog.coordinator(
            "queueTranscode",
            fileId,
            "emitQueued=$emitQueued shouldStart=$shouldStart status=${store.getTranscodeStatus(fileId)}"
        )
        if (shouldStart) {
            tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
        }
    }

    private suspend fun tryStartPendingJobs(excludeFileId: Int?) {
        if (preemptActiveTranscodeForPrepareBlocking()) {
            return
        }

        val fileIdToRun = stateMutex.withLock {
            if (activeTranscodeFileId != null) {
                VideoTranscodeLog.coordinator(
                    "tryStartPendingJobs",
                    activeTranscodeFileId,
                    "skipped — active job already running (exclude=$excludeFileId pending=${pendingFileIds.size})"
                )
                return@withLock null
            }
            pendingFileIds.removeAll { candidate ->
                store.getTranscodedFileIfReady(candidate) != null
            }
            val blockingId = prepareBlockingFileId
            val nextFileId = selectNextPendingTranscodeFileId(
                pendingFileIds = pendingFileIds,
                currentlyPlayingFileId = excludeFileId,
                prepareBlockingFileId = blockingId,
                isPendingAndNotReady = { candidate ->
                    store.getTranscodeStatus(candidate) == TranscodeStatus.PENDING &&
                        store.getTranscodedFileIfReady(candidate) == null
                }
            )
            if (nextFileId == null) {
                VideoTranscodeLog.coordinator(
                    "tryStartPendingJobs",
                    detail = "no eligible job | exclude=$excludeFileId prepareBlock=$blockingId " +
                        "pending=$pendingFileIds"
                )
                return@withLock null
            }
            pendingFileIds.remove(nextFileId)
            activeTranscodeFileId = nextFileId
            VideoTranscodeLog.coordinator(
                "tryStartPendingJobs",
                nextFileId,
                "starting job | exclude=$excludeFileId prepareBlock=$blockingId remainingPending=$pendingFileIds"
            )
            nextFileId
        } ?: return

        val job = transcodeScope.launch {
            runTranscodeJob(fileIdToRun)
        }
        stateMutex.withLock {
            activeTranscodeJob = job
        }
    }

    private suspend fun runTranscodeJob(fileId: Int) {
        var lastLoggedPercent = -1
        val isPrepareJob = stateMutex.withLock { prepareBlockingFileId == fileId }
        VideoTranscodeLog.coordinator(
            "runTranscodeJob_enter",
            fileId,
            "isPrepareJob=$isPrepareJob currentlyPlaying=$currentlyPlayingFileId"
        )
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

            if (transcoder.shouldSkipTranscode(input)) {
                VideoTranscodeLog.skipped(
                    fileId,
                    "source already H.264 within display resolution and bitrate limits"
                )
                store.updateTranscodeStatus(fileId, TranscodeStatus.NONE)
                return
            }

            val plan = transcoder.planTranscode(input)
            if (plan == null) {
                VideoTranscodeLog.error(fileId, "could not read video metadata")
                store.updateTranscodeStatus(fileId, TranscodeStatus.FAILED)
                _events.emit(TranscodeEvent.Failed(fileId))
                return
            }

            val outputName = VideoAssetEntry.transcodedFileNameFor(fileId)
            store.updateTranscodeStatus(fileId, TranscodeStatus.RUNNING, outputName)
            _events.emit(TranscodeEvent.Running(fileId, progress = 0f))

            val output = store.transcodedFileFor(entry.copy(transcodedFileName = outputName))
            VideoTranscodeLog.started(
                fileId,
                input.name,
                plan.targetHeightPx,
                plan.videoBitrate,
                plan.source.displayHeight
            )
            VideoTranscodeLog.progress(fileId, 0)

            VideoTranscodeLog.coordinator(
                "runTranscodeJob_calling_transcoder",
                fileId,
                "input=${input.absolutePath} (${VideoTranscodeLog.formatSize(input.length())})"
            )

            val transcodeBlock: suspend () -> Unit = {
                transcoder.transcode(input, output, fileId = fileId) { progress ->
                    val percent = (progress * 100).toInt().coerceIn(0, 100)
                    if (percent >= lastLoggedPercent + 10 || percent == 100) {
                        lastLoggedPercent = percent
                        VideoTranscodeLog.progress(fileId, percent)
                    }
                    _events.emit(TranscodeEvent.Running(fileId, progress))
                }
            }
            if (isPrepareJob) {
                transcodeBlock()
            } else {
                withContext(NonCancellable) {
                    transcodeBlock()
                }
            }
            store.updateTranscodeStatus(fileId, TranscodeStatus.READY, outputName)
            store.deleteLegacyTranscodedFile(fileId)
            _events.emit(TranscodeEvent.Ready(fileId))
            VideoTranscodeLog.completed(fileId, output.name, output.length())
        } catch (t: Throwable) {
            if (t is CancellationException) {
                VideoTranscodeLog.cancelled(fileId)
                VideoTranscodeLog.coordinator("runTranscodeJob_cancelled", fileId)
                deletePartialTranscodeOutput(fileId)
                store.updateTranscodeStatus(fileId, TranscodeStatus.PENDING)
                stateMutex.withLock {
                    pendingFileIds.add(fileId)
                    prepareBlockingFileId?.let { movePendingFileToFront(it) }
                }
                return
            }
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
            VideoTranscodeLog.coordinator("runTranscodeJob_exit", fileId)
            stateMutex.withLock {
                if (prepareBlockingFileId == fileId) {
                    prepareBlockingFileId = null
                }
                activeTranscodeFileId = null
                activeTranscodeJob = null
            }
            tryStartPendingJobs(excludeFileId = currentlyPlayingFileId)
        }
    }

    private fun logSkipOnce(key: String, fileId: Int?, reason: String) {
        if (skipReasonLoggedKeys.add(key)) {
            VideoTranscodeLog.skipped(fileId, reason)
        }
    }

    /**
     * When the user is blocked waiting for [prepareBlockingFileId], cancel an in-flight transcode
     * for another file so progress events match the dialog.
     */
    private suspend fun preemptActiveTranscodeForPrepareBlocking(): Boolean {
        val (blockingId, activeId, job) = stateMutex.withLock {
            val blocking = prepareBlockingFileId ?: return false
            val active = activeTranscodeFileId ?: return false
            if (active == blocking) return false
            if (!pendingFileIds.contains(blocking)) return false
            Triple(blocking, active, activeTranscodeJob)
        }
        VideoTranscodeLog.coordinator(
            "preemptActiveTranscode",
            blockingId,
            "cancelling in-flight file $activeId"
        )
        job?.cancel()
        return true
    }

    private fun movePendingFileToFront(fileId: Int) {
        if (!pendingFileIds.remove(fileId)) return
        val rest = pendingFileIds.toList()
        pendingFileIds.clear()
        pendingFileIds.add(fileId)
        pendingFileIds.addAll(rest)
    }

    private fun deletePartialTranscodeOutput(fileId: Int) {
        val entry = store.getEntry(fileId) ?: return
        store.deleteTranscodedFileFor(
            entry.copy(transcodedFileName = VideoAssetEntry.transcodedFileNameFor(fileId))
        )
    }

    companion object {
        private const val QUEUE_COOLDOWN_MS = 10 * 60 * 1000L
    }
}
