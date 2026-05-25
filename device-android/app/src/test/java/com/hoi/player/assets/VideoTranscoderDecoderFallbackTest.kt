package com.hoi.player.assets

import androidx.media3.transformer.ExportException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoTranscoderDecoderFallbackTest {

    @Test
    fun isDecoderCodecExport_matchesDecodingFailureCode() {
        assertTrue(
            VideoTranscoder.isDecoderCodecExport(
                ExportException.ERROR_CODE_DECODING_FAILED,
                "Codec exception"
            )
        )
    }

    @Test
    fun isDecoderCodecExport_ignoresUnrelatedErrors() {
        assertFalse(
            VideoTranscoder.isDecoderCodecExport(
                ExportException.ERROR_CODE_UNSPECIFIED,
                "muxer stalled"
            )
        )
    }

    @Test
    fun isDecoderCodecExport_matchesCodecInMessage() {
        assertTrue(
            VideoTranscoder.isDecoderCodecExport(
                ExportException.ERROR_CODE_UNSPECIFIED,
                "Codec init failed"
            )
        )
    }
}
