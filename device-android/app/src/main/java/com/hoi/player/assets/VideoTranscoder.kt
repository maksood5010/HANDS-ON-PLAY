package com.hoi.player.assets

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.Clock
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultAssetLoaderFactory
import androidx.media3.transformer.DefaultDecoderFactory
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
@Singleton
class VideoTranscoder @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val transcodeThread = HandlerThread(
        "video-transcode",
        Process.THREAD_PRIORITY_BACKGROUND
    ).apply { start() }
    private val transcodeHandler = Handler(transcodeThread.looper)
    private val transcodeDispatcher = transcodeHandler.asCoroutineDispatcher()

    data class TranscodePlan(
        val targetHeightPx: Int,
        val videoBitrate: Int,
        val displayHeightPx: Int,
        val source: VideoSourceInfo
    )

    fun planTranscode(input: File): TranscodePlan? {
        val source = VideoSourceInspector.probe(input) ?: return null
        val displayHeight = VideoTranscodeProfile.displayHeightPx(context)
        val targetHeight = VideoTranscodeProfile.computeTargetHeightPx(
            source.displayHeight,
            displayHeight
        )
        val videoBitrate = VideoTranscodeProfile.bitrateForHeight(targetHeight)
        return TranscodePlan(targetHeight, videoBitrate, displayHeight, source)
    }

    fun shouldSkipTranscode(input: File): Boolean {
        val plan = planTranscode(input) ?: return false
        return VideoTranscodeProfile.shouldSkipTranscode(plan.source, plan.targetHeightPx)
    }

    suspend fun transcode(
        input: File,
        output: File,
        fileId: Int? = null,
        onProgress: suspend (Float) -> Unit = {}
    ) {
        val plan = planTranscode(input)
            ?: throw IllegalStateException("Could not read video metadata from ${input.name}")

        val partFile = File(output.parentFile, "${output.name}.part")
        partFile.parentFile?.mkdirs()
        if (partFile.exists() && partFile.length() == 0L) partFile.delete()

        VideoTranscodeLog.transformer(
            phase = "transcode_enter",
            fileId = fileId,
            detail = "input=${input.absolutePath} (${VideoTranscodeLog.formatSize(input.length())}) " +
                "output=${output.absolutePath} part=${partFile.absolutePath} " +
                "mime=${plan.source.mimeType} ${plan.source.width}x${plan.source.height} rot=${plan.source.rotationDegrees}"
        )

        withContext(transcodeDispatcher) {
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
            VideoTranscodeLog.transformer(
                phase = "transcode_thread",
                fileId = fileId,
                detail = "thread=${Thread.currentThread().name} looper=${transcodeThread.looper.thread.name} " +
                    "mainLooper=${Looper.getMainLooper().thread.name}"
            )
            runTranscodeWithDecoderFallback(input, partFile, plan, fileId, onProgress)
        }

        if (output.exists() && !output.delete()) {
            // Best-effort replace of previous output
        }
        if (!partFile.renameTo(output)) {
            partFile.copyTo(output, overwrite = true)
            partFile.delete()
        }
        if (!output.exists() || output.length() <= 0) {
            partFile.delete()
            throw IllegalStateException("Transcoded output missing or empty")
        }
        VideoTranscodeLog.transformer(
            phase = "transcode_exit_ok",
            fileId = fileId,
            detail = "output=${output.absolutePath} (${VideoTranscodeLog.formatSize(output.length())})"
        )
    }

    private suspend fun runTranscodeWithDecoderFallback(
        input: File,
        partFile: File,
        plan: TranscodePlan,
        fileId: Int?,
        onProgress: suspend (Float) -> Unit
    ) {
        try {
            runTranscode(input, partFile, plan, fileId, onProgress, preferSoftwareDecoder = false)
        } catch (first: ExportException) {
            VideoTranscodeLog.transformerExportError(
                fileId = fileId,
                errorCode = first.errorCode,
                message = first.message,
                preferSoftwareDecoder = false,
                cause = first
            )
            if (!isDecoderCodecExportException(first)) throw first
            VideoTranscodeLog.transformer(
                phase = "decoder_fallback_retry",
                fileId = fileId,
                detail = "retrying with software decoder preference"
            )
            partFile.delete()
            runTranscode(input, partFile, plan, fileId, onProgress, preferSoftwareDecoder = true)
        }
    }

    private suspend fun runTranscode(
        input: File,
        partFile: File,
        plan: TranscodePlan,
        fileId: Int?,
        onProgress: suspend (Float) -> Unit,
        preferSoftwareDecoder: Boolean
    ) = suspendCancellableCoroutine { cont ->
        val inputUri = input.toURI().toString()
        VideoTranscodeLog.transformer(
            phase = "run_start",
            fileId = fileId,
            detail = "uri=$inputUri swDecoder=$preferSoftwareDecoder targetH=${plan.targetHeightPx} " +
                "bitrate=${plan.videoBitrate} part=${partFile.absolutePath}"
        )

        val editedMediaItem = EditedMediaItem.Builder(MediaItem.fromUri(inputUri))
            .setEffects(
                Effects(
                    /* audioProcessors = */ emptyList(),
                    /* videoEffects = */ listOf(
                        Presentation.createForHeight(plan.targetHeightPx)
                    )
                )
            )
            .build()

        val progressScope = CoroutineScope(transcodeDispatcher)
        val progressHolder = ProgressHolder()
        var progressJob: Job? = null

        val decoderFactory = DefaultDecoderFactory.Builder(context)
            .setEnableDecoderFallback(true)
            .apply {
                if (preferSoftwareDecoder) {
                    setMediaCodecSelector(preferSoftwareMediaCodecSelector())
                }
            }
            .build()

        val encoderFactory = DefaultEncoderFactory.Builder(context)
            .setRequestedVideoEncoderSettings(
                VideoEncoderSettings.Builder()
                    .setBitrate(plan.videoBitrate)
                    .build()
            )
            .build()

        val transformer = Transformer.Builder(context)
            .setLooper(transcodeThread.looper)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .setEncoderFactory(encoderFactory)
            .setAssetLoaderFactory(
                DefaultAssetLoaderFactory(context, decoderFactory, Clock.DEFAULT)
            )
            .addListener(
                object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        VideoTranscodeLog.transformer(
                            phase = "onCompleted",
                            fileId = fileId,
                            detail = "part=${VideoTranscodeLog.formatSize(partFile.length())} " +
                                "exportDurationMs=${exportResult.durationMs} " +
                                "swDecoder=$preferSoftwareDecoder"
                        )
                        progressJob?.cancel()
                        if (cont.isActive) cont.resume(Unit)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException
                    ) {
                        VideoTranscodeLog.transformerExportError(
                            fileId = fileId,
                            errorCode = exportException.errorCode,
                            message = exportException.message,
                            preferSoftwareDecoder = preferSoftwareDecoder,
                            cause = exportException
                        )
                        progressJob?.cancel()
                        partFile.delete()
                        if (cont.isActive) cont.resumeWithException(exportException)
                    }
                }
            )
            .build()

        val exportStartMs = SystemClock.elapsedRealtime()
        var lastLoggedProgressState: Int? = null
        var lastReportedPercent = -1
        var pollCount = 0
        var lastStallWarnMs = 0L

        progressJob = progressScope.launch {
            while (isActive) {
                pollCount++
                val elapsedMs = SystemClock.elapsedRealtime() - exportStartMs
                val progressState = transformer.getProgress(progressHolder)
                val stateName = progressStateName(progressState)
                val progressPercent = when (progressState) {
                    Transformer.PROGRESS_STATE_AVAILABLE -> progressHolder.progress
                    else -> null
                }
                val partBytes = partFile.length()

                val stateChanged = progressState != lastLoggedProgressState
                val percentChanged = progressPercent != null && progressPercent != lastReportedPercent
                val logThisPoll = stateChanged || percentChanged || pollCount == 1 ||
                    (elapsedMs >= STALL_WARN_INTERVAL_MS && (progressPercent == null || progressPercent == 0))
                if (logThisPoll) {
                    VideoTranscodeLog.progressPoll(
                        fileId = fileId,
                        progressState = stateName,
                        progressPercent = progressPercent,
                        partBytes = partBytes,
                        inputBytes = input.length(),
                        elapsedMs = elapsedMs,
                        preferSoftwareDecoder = preferSoftwareDecoder
                    )
                    lastLoggedProgressState = progressState
                    if (progressPercent != null) {
                        lastReportedPercent = progressPercent
                    }
                }

                when (progressState) {
                    Transformer.PROGRESS_STATE_AVAILABLE -> {
                        onProgress(progressHolder.progress / 100f)
                    }
                }

                val stuckAtZero = progressPercent == null || progressPercent == 0
                if (stuckAtZero && elapsedMs >= STALL_WARN_INTERVAL_MS &&
                    elapsedMs - lastStallWarnMs >= STALL_WARN_INTERVAL_MS
                ) {
                    lastStallWarnMs = elapsedMs
                    VideoTranscodeLog.progressStallWarning(
                        fileId = fileId,
                        progressState = stateName,
                        partBytes = partBytes,
                        elapsedMs = elapsedMs,
                        pollCount = pollCount
                    )
                }

                delay(PROGRESS_POLL_MS)
            }
        }

        cont.invokeOnCancellation {
            VideoTranscodeLog.transformer(
                phase = "cancelled",
                fileId = fileId,
                detail = "cancelling progress poll swDecoder=$preferSoftwareDecoder"
            )
            progressJob?.cancel()
            runCatching { transformer.cancel() }
                .onFailure { t ->
                    VideoTranscodeLog.transformer(
                        phase = "cancel_failed",
                        fileId = fileId,
                        detail = t.message
                    )
                }
        }

        VideoTranscodeLog.transformer(
            phase = "start_called",
            fileId = fileId,
            detail = "calling transformer.start on thread=${Thread.currentThread().name} " +
                "appLooper=${transformer.getApplicationLooper().thread.name}"
        )
        transformer.start(editedMediaItem, partFile.absolutePath)
        VideoTranscodeLog.transformer(
            phase = "start_returned",
            fileId = fileId,
            detail = "transformer.start returned (async export running)"
        )
    }

    companion object {
        private const val PROGRESS_POLL_MS = 2_000L
        private const val STALL_WARN_INTERVAL_MS = 10_000L

        private fun progressStateName(state: Int): String = when (state) {
            Transformer.PROGRESS_STATE_NOT_STARTED -> "NOT_STARTED"
            Transformer.PROGRESS_STATE_WAITING_FOR_AVAILABILITY -> "WAITING"
            Transformer.PROGRESS_STATE_AVAILABLE -> "AVAILABLE"
            Transformer.PROGRESS_STATE_UNAVAILABLE -> "UNAVAILABLE"
            else -> "UNKNOWN($state)"
        }

        private fun preferSoftwareMediaCodecSelector(): MediaCodecSelector =
            MediaCodecSelector { mimeType, requiresSecureDecoder, requiresTunnelingDecoder ->
                MediaCodecUtil.getDecoderInfos(
                    mimeType,
                    requiresSecureDecoder,
                    requiresTunnelingDecoder
                ).sortedByDescending { it.softwareOnly }
            }

        internal fun isDecoderCodecExport(errorCode: Int, message: String?): Boolean {
            return when (errorCode) {
                ExportException.ERROR_CODE_DECODER_INIT_FAILED,
                ExportException.ERROR_CODE_DECODING_FAILED,
                ExportException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED -> true
                else -> message?.contains("Codec", ignoreCase = true) == true
            }
        }

        internal fun isDecoderCodecExportException(exception: ExportException): Boolean =
            isDecoderCodecExport(exception.errorCode, exception.message)
    }
}
