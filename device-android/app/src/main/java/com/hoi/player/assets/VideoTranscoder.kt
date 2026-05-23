package com.hoi.player.assets

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
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
import java.util.concurrent.atomic.AtomicBoolean
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
        onProgress: suspend (Float) -> Unit = {}
    ) {
        val plan = planTranscode(input)
            ?: throw IllegalStateException("Could not read video metadata from ${input.name}")

        val partFile = File(output.parentFile, "${output.name}.part")
        partFile.parentFile?.mkdirs()
        if (partFile.exists() && partFile.length() == 0L) partFile.delete()

        withContext(transcodeDispatcher) {
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
            runTranscodeWithDecoderFallback(input, partFile, plan, onProgress)
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
    }

    private suspend fun runTranscodeWithDecoderFallback(
        input: File,
        partFile: File,
        plan: TranscodePlan,
        onProgress: suspend (Float) -> Unit
    ) {
        try {
            runTranscode(input, partFile, plan, onProgress, preferSoftwareDecoder = false)
        } catch (first: ExportException) {
            if (!isDecoderCodecExportException(first)) throw first
            partFile.delete()
            runTranscode(input, partFile, plan, onProgress, preferSoftwareDecoder = true)
        }
    }

    private suspend fun runTranscode(
        input: File,
        partFile: File,
        plan: TranscodePlan,
        onProgress: suspend (Float) -> Unit,
        preferSoftwareDecoder: Boolean
    ) = suspendCancellableCoroutine { cont ->
        val editedMediaItem = EditedMediaItem.Builder(MediaItem.fromUri(input.toURI().toString()))
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
                        progressJob?.cancel()
                        if (cont.isActive) cont.resume(Unit)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException
                    ) {
                        progressJob?.cancel()
                        partFile.delete()
                        if (cont.isActive) cont.resumeWithException(exportException)
                    }
                }
            )
            .build()

        progressJob = progressScope.launch {
            while (isActive) {
                when (transformer.getProgress(progressHolder)) {
                    Transformer.PROGRESS_STATE_AVAILABLE -> {
                        onProgress(progressHolder.progress / 100f)
                    }
                }
                delay(PROGRESS_POLL_MS)
            }
        }

        cont.invokeOnCancellation {
            progressJob?.cancel()
        }

        transformer.start(editedMediaItem, partFile.absolutePath)
    }

    companion object {
        private const val PROGRESS_POLL_MS = 2_000L

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
