package com.hoi.player.playback

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.analytics.PlaybackStats
import androidx.media3.exoplayer.analytics.PlaybackStatsListener

@OptIn(UnstableApi::class)
class PlaybackMonitor private constructor(
    private val player: ExoPlayer,
    private val stallDetector: PlaybackStallDetector,
    private val onHighFrameDropRate: ((uri: String, dropRateFps: Double) -> Unit)?
) {
    private val analyticsListener = object : AnalyticsListener {
        override fun onDroppedVideoFrames(
            eventTime: AnalyticsListener.EventTime,
            droppedFrames: Int,
            elapsedMs: Long
        ) {
            if (droppedFrames <= 0) return
            val dropRateFps = if (elapsedMs > 0) droppedFrames * 1000.0 / elapsedMs else 0.0
            val uri = currentUri()
            Log.w(
                TAG,
                "Frame drops uri=$uri dropped=$droppedFrames in ${elapsedMs}ms " +
                    "(~${"%.1f".format(dropRateFps)} fps)"
            )
            if (dropRateFps >= HIGH_DROP_RATE_FPS) {
                Log.w(TAG, "High frame drop rate uri=$uri (~${"%.1f".format(dropRateFps)} fps)")
                uri?.let { safeUri -> onHighFrameDropRate?.invoke(safeUri, dropRateFps) }
            }
        }

        override fun onPlaybackStateChanged(
            eventTime: AnalyticsListener.EventTime,
            state: Int
        ) {
            if (state != Player.STATE_BUFFERING) return
            val positionMs = eventTime.currentPlaybackPositionMs
            if (positionMs <= 500L) return
            Log.w(
                TAG,
                "Rebuffering uri=${currentUri()} positionMs=$positionMs " +
                    "bufferedMs=${player.bufferedPosition - positionMs}"
            )
        }
    }

    private val statsListener = PlaybackStatsListener(/* keepHistory = */ false) { _, stats ->
        if (!isUnhealthy(stats)) return@PlaybackStatsListener
        Log.w(
            TAG,
            "Unhealthy playback uri=${currentUri()} " +
                "rebufferCount=${stats.totalRebufferCount} " +
                "rebufferTimeMs=${stats.totalRebufferTimeMs} " +
                "droppedFrames=${stats.totalDroppedFrames} " +
                "playTimeMs=${stats.totalPlayTimeMs}"
        )
    }

    fun start() {
        player.addAnalyticsListener(analyticsListener)
        player.addAnalyticsListener(statsListener)
        stallDetector.start()
    }

    fun stop() {
        stallDetector.stop()
        player.removeAnalyticsListener(analyticsListener)
        player.removeAnalyticsListener(statsListener)
    }

    private fun currentUri(): String? =
        player.currentMediaItem?.localConfiguration?.uri?.toString()

    companion object {
        private const val TAG = "PlaybackMetrics"
        private const val HIGH_DROP_RATE_FPS = 5.0

        fun attach(
            player: ExoPlayer,
            onHighFrameDropRate: ((uri: String, dropRateFps: Double) -> Unit)? = null
        ): PlaybackMonitor {
            val stallDetector = PlaybackStallDetector(
                player = player,
                onStall = { uri, positionMs ->
                    Log.w(TAG, "Playback stalled uri=$uri positionMs=$positionMs")
                }
            )
            return PlaybackMonitor(player, stallDetector, onHighFrameDropRate).also { it.start() }
        }

        fun isUnhealthy(stats: PlaybackStats): Boolean =
            stats.totalRebufferCount > 3 ||
                stats.totalDroppedFrames > 30 ||
                stats.totalRebufferTimeMs > 5_000L
    }
}

class PlaybackStallDetector(
    private val player: Player,
    private val onStall: (uri: String?, positionMs: Long) -> Unit,
    private val handler: Handler = Handler(Looper.getMainLooper()),
    private val checkIntervalMs: Long = 1_000L,
    private val stallThresholdMs: Long = 3_000L
) {
    private var lastPositionMs = 0L
    private var lastAdvanceAtMs = SystemClock.elapsedRealtime()
    private var running = false

    private val checkRunnable = object : Runnable {
        override fun run() {
            if (!running) return
            evaluate()
            handler.postDelayed(this, checkIntervalMs)
        }
    }

    fun start() {
        if (running) return
        running = true
        lastPositionMs = player.currentPosition
        lastAdvanceAtMs = SystemClock.elapsedRealtime()
        handler.post(checkRunnable)
    }

    fun stop() {
        running = false
        handler.removeCallbacks(checkRunnable)
    }

    internal fun evaluate(nowMs: Long = SystemClock.elapsedRealtime()) {
        if (!shouldMonitorPlaybackStall(player.playWhenReady, player.playbackState)) {
            lastPositionMs = player.currentPosition
            lastAdvanceAtMs = nowMs
            return
        }

        val positionMs = player.currentPosition
        if (positionMs > lastPositionMs + MIN_POSITION_ADVANCE_MS) {
            lastPositionMs = positionMs
            lastAdvanceAtMs = nowMs
            return
        }

        if (isPositionStalled(lastAdvanceAtMs, nowMs, stallThresholdMs)) {
            val uri = player.currentMediaItem?.localConfiguration?.uri?.toString()
            onStall(uri, positionMs)
            lastAdvanceAtMs = nowMs
        }
    }

    companion object {
        private const val MIN_POSITION_ADVANCE_MS = 250L
    }
}

fun shouldMonitorPlaybackStall(playWhenReady: Boolean, playbackState: Int): Boolean =
    playWhenReady &&
        playbackState != Player.STATE_ENDED &&
        playbackState != Player.STATE_IDLE

fun isPositionStalled(
    lastAdvanceAtMs: Long,
    nowMs: Long,
    stallThresholdMs: Long = 3_000L
): Boolean = nowMs - lastAdvanceAtMs >= stallThresholdMs
