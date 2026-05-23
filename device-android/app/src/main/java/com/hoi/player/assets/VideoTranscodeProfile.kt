package com.hoi.player.assets

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import androidx.media3.common.MimeTypes
import java.io.File

/** Transcode output profile (bump [PROFILE_VERSION] to invalidate older exports). */
object VideoTranscodeProfile {
    const val PROFILE_VERSION = "v2"

    const val MIN_HEIGHT_PX = 480
    /** 1080p frame height aligned to 16px (68 × 16). */
    const val MAX_HEIGHT_PX = 1088
    private const val HEIGHT_ALIGNMENT_PX = 16
    private const val SKIP_BITRATE_HEADROOM = 1.25

    fun transcodedFileNameFor(fileId: Int): String =
        "$fileId.transcoded.$PROFILE_VERSION.mp4"

    fun legacyTranscodedFileNameFor(fileId: Int): String =
        "$fileId.transcoded.mp4"

    /** Vertical resolution of the panel in the current orientation. */
    fun displayHeightPx(context: Context): Int {
        val dm = context.resources.displayMetrics
        return if (dm.widthPixels >= dm.heightPixels) {
            dm.heightPixels
        } else {
            dm.widthPixels
        }.coerceAtLeast(MIN_HEIGHT_PX)
    }

    fun alignHeight(heightPx: Int): Int {
        val aligned = (heightPx / HEIGHT_ALIGNMENT_PX) * HEIGHT_ALIGNMENT_PX
        return aligned.coerceAtLeast(MIN_HEIGHT_PX)
    }

    fun computeTargetHeightPx(sourceHeightPx: Int, displayHeightPx: Int): Int {
        val capped = minOf(sourceHeightPx, displayHeightPx, MAX_HEIGHT_PX)
            .coerceAtLeast(MIN_HEIGHT_PX)
        return alignHeight(capped)
    }

    fun bitrateForHeight(heightPx: Int): Int = when {
        heightPx >= 1080 -> 8_000_000
        heightPx >= 720 -> 5_000_000
        else -> 2_500_000
    }

    fun shouldSkipTranscode(source: VideoSourceInfo, targetHeightPx: Int): Boolean {
        if (!source.isH264()) return false
        if (source.displayHeight > targetHeightPx) return false
        val sourceBitrate = source.bitrate ?: return false
        val maxBitrate = (bitrateForHeight(source.displayHeight) * SKIP_BITRATE_HEADROOM).toInt()
        return sourceBitrate <= maxBitrate
    }
}

data class VideoSourceInfo(
    val width: Int,
    val height: Int,
    val rotationDegrees: Int,
    val mimeType: String?,
    val bitrate: Int?
) {
    val displayHeight: Int
        get() = if (rotationDegrees == 90 || rotationDegrees == 270) width else height

    fun isH264(): Boolean {
        val mime = mimeType?.lowercase() ?: return false
        return mime == MimeTypes.VIDEO_H264 || mime.contains("avc")
    }
}

object VideoSourceInspector {
    fun probe(file: File): VideoSourceInfo? {
        probeWithMediaExtractor(file)?.let { return it }
        return probeWithRetriever(file)
    }

    private fun probeWithMediaExtractor(file: File): VideoSourceInfo? {
        val extractor = MediaExtractor()
        return try {
            extractor.setDataSource(file.absolutePath)
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                if (!mime.startsWith("video/")) continue
                val width = format.getInteger(MediaFormat.KEY_WIDTH)
                val height = format.getInteger(MediaFormat.KEY_HEIGHT)
                val rotation = if (format.containsKey(MediaFormat.KEY_ROTATION)) {
                    format.getInteger(MediaFormat.KEY_ROTATION)
                } else {
                    0
                }
                val bitrate = if (format.containsKey(MediaFormat.KEY_BIT_RATE)) {
                    format.getInteger(MediaFormat.KEY_BIT_RATE)
                } else {
                    null
                }
                return VideoSourceInfo(width, height, rotation, mime, bitrate)
            }
            null
        } catch (_: Throwable) {
            null
        } finally {
            extractor.release()
        }
    }

    private fun probeWithRetriever(file: File): VideoSourceInfo? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: return null
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: return null
            val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
                ?.toIntOrNull() ?: 0
            val mime = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE)
            val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
                ?.toIntOrNull()
            VideoSourceInfo(width, height, rotation, mime, bitrate)
        } catch (_: Throwable) {
            null
        } finally {
            retriever.release()
        }
    }
}
