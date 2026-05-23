package com.hoi.player.assets

import androidx.media3.transformer.ExportException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoTranscoderDecoderFallbackTest {

    @Test
    fun isDecoderCodecExportException_matchesDecodingFailureCode() {
        val exception = ExportException.createForCodec(
            IllegalStateException(),
            ExportException.ERROR_CODE_DECODING_FAILED,
            null
        )
        assertTrue(VideoTranscoder.isDecoderCodecExportException(exception))
    }

    @Test
    fun isDecoderCodecExportException_ignoresUnrelatedErrors() {
        val exception = ExportException.createForUnexpected(
            IllegalStateException("muxer stalled")
        )
        assertFalse(VideoTranscoder.isDecoderCodecExportException(exception))
    }
}
