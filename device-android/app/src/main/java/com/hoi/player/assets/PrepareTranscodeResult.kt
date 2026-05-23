package com.hoi.player.assets

sealed class PrepareTranscodeResult {
    data object Started : PrepareTranscodeResult()
    data object AlreadyReady : PrepareTranscodeResult()
    data object Skipped : PrepareTranscodeResult()
    data object NotReady : PrepareTranscodeResult()
}
