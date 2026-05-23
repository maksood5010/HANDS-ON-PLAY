package com.hoi.player.viewmodel

import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoi.player.assets.PrepareTranscodeResult
import com.hoi.player.assets.TranscodeStatus
import com.hoi.player.assets.VideoAssetStore
import com.hoi.player.assets.VideoAssetSyncCoordinator
import com.hoi.player.assets.VideoTranscodeCoordinator
import com.hoi.player.models.DisplayPlaylistResponse
import com.hoi.player.models.Playlist
import com.hoi.player.models.ValidateDeviceResponse
import com.hoi.player.models.VideoPlaybackUriOptions
import com.hoi.player.network.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import javax.inject.Inject

private const val HEARTBEAT_INTERVAL_MS = 60_000L

@HiltViewModel
class MainViewModel @Inject constructor(
    private val apiService: ApiService,
    private val videoAssetStore: VideoAssetStore,
    private val videoAssetSyncCoordinator: VideoAssetSyncCoordinator,
    private val videoTranscodeCoordinator: VideoTranscodeCoordinator
) : ViewModel() {

    private var heartbeatJob: Job? = null
    private var validateJob: Job? = null
    private var prepareJob: Job? = null

    private var prepareGateFileId: Int? = null
    private var lastCurrentVideoFileId: Int? = null
    private var blockedLabel: String? = null
    private val bypassLocalTranscodeFileIds = mutableSetOf<Int>()
    private val playedDuringCurrentVisitFileIds = mutableSetOf<Int>()

    private val _deviceValidationResult = MutableLiveData<ValidateDeviceResponse?>()
    val deviceValidationResult: LiveData<ValidateDeviceResponse?> = _deviceValidationResult

    private val _deviceValidationError = MutableLiveData<String?>()
    val deviceValidationError: LiveData<String?> = _deviceValidationError

    private val _playlistResult = MutableLiveData<DisplayPlaylistResponse?>()
    val playlistResult: LiveData<DisplayPlaylistResponse?> = _playlistResult

    private val _playlistError = MutableLiveData<String?>()
    val playlistError: LiveData<String?> = _playlistError

    private val _heartbeatError = MutableLiveData<String?>()
    val heartbeatError: LiveData<String?> = _heartbeatError

    private val _transcodeEvent = MutableLiveData<TranscodeUiEvent>()
    val transcodeEvent: LiveData<TranscodeUiEvent> = _transcodeEvent

    private val _playbackGate = MutableLiveData<PlaybackGateState>(PlaybackGateState.Open)
    val playbackGate: LiveData<PlaybackGateState> = _playbackGate

    init {
        viewModelScope.launch {
            videoTranscodeCoordinator.events.collect { event ->
                val uiEvent = TranscodeUiEvent.from(event)
                _transcodeEvent.postValue(uiEvent)
                handleTranscodeEventForGate(uiEvent)
            }
        }
    }

    fun shouldBypassLocalTranscode(fileId: Int?): Boolean {
        if (fileId == null) return false
        if (fileId in bypassLocalTranscodeFileIds) return true
        return videoAssetStore.getTranscodeStatus(fileId) == TranscodeStatus.FAILED
    }

    fun currentPlaybackUriOptions(): VideoPlaybackUriOptions =
        VideoPlaybackUriOptions(bypassLocalTranscodeFileIds = bypassLocalTranscodeFileIds.toSet())

    /** True when this item already played on the current page (e.g. skip → remote) — Ready should advance, not replay. */
    fun shouldAdvanceOnTranscodeReady(fileId: Int): Boolean =
        shouldAdvanceOnTranscodeReady(
            fileId,
            bypassLocalTranscodeFileIds,
            playedDuringCurrentVisitFileIds
        )

    fun onCurrentVideoSelected(fileId: Int?, label: String? = null) {
        prepareJob?.cancel()
        val previousId = lastCurrentVideoFileId
        lastCurrentVideoFileId = fileId
        blockedLabel = label
        prepareJob = viewModelScope.launch(Dispatchers.IO) {
            if (previousId != null && previousId != fileId) {
                bypassLocalTranscodeFileIds.remove(previousId)
                videoTranscodeCoordinator.cancelPrepare(previousId)
            }
            val gateFileId = prepareGateFileId
            if (gateFileId != null && gateFileId != fileId) {
                videoTranscodeCoordinator.cancelPrepare(gateFileId)
                prepareGateFileId = null
                _playbackGate.postValue(PlaybackGateState.Open)
            }

            if (fileId == null) {
                prepareGateFileId = null
                _playbackGate.postValue(PlaybackGateState.Open)
                return@launch
            }

            bypassLocalTranscodeFileIds.remove(fileId)
            playedDuringCurrentVisitFileIds.remove(fileId)

            when (val result = videoTranscodeCoordinator.requestPrepareTranscode(fileId)) {
                PrepareTranscodeResult.Started -> {
                    prepareGateFileId = fileId
                    playedDuringCurrentVisitFileIds.remove(fileId)
                    _playbackGate.postValue(
                        PlaybackGateState.Blocked(
                            fileId = fileId,
                            label = label,
                            progressPercent = 0
                        )
                    )
                }
                PrepareTranscodeResult.AlreadyReady,
                PrepareTranscodeResult.Skipped,
                PrepareTranscodeResult.NotReady -> {
                    prepareGateFileId = null
                    _playbackGate.postValue(PlaybackGateState.Open)
                }
            }
        }
    }

    fun onSkipPrepareTranscode(fileId: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            videoTranscodeCoordinator.skipPrepareTranscode(fileId)
            if (prepareGateFileId == fileId) {
                prepareGateFileId = null
            }
            bypassLocalTranscodeFileIds.add(fileId)
            playedDuringCurrentVisitFileIds.add(fileId)
            _playbackGate.postValue(PlaybackGateState.Open)
            _transcodeEvent.postValue(TranscodeUiEvent.PrepareSkipped(fileId))
        }
    }

    private fun handleTranscodeEventForGate(event: TranscodeUiEvent) {
        val gateFileId = prepareGateFileId ?: return
        when (event) {
            is TranscodeUiEvent.Running -> {
                if (event.fileId != gateFileId) return
                _playbackGate.postValue(
                    PlaybackGateState.Blocked(
                        fileId = gateFileId,
                        label = blockedLabel,
                        progressPercent = (event.progress * 100).toInt().coerceIn(0, 100)
                    )
                )
            }
            is TranscodeUiEvent.Ready -> {
                if (event.fileId != gateFileId) return
                prepareGateFileId = null
                bypassLocalTranscodeFileIds.remove(gateFileId)
                _playbackGate.postValue(PlaybackGateState.Open)
            }
            is TranscodeUiEvent.Failed -> {
                if (event.fileId != gateFileId) return
                prepareGateFileId = null
                bypassLocalTranscodeFileIds.add(gateFileId)
                _playbackGate.postValue(PlaybackGateState.Open)
            }
            is TranscodeUiEvent.Queued -> {
                if (event.fileId != gateFileId) return
                _playbackGate.postValue(
                    PlaybackGateState.Blocked(
                        fileId = gateFileId,
                        label = blockedLabel,
                        progressPercent = 0
                    )
                )
            }
            is TranscodeUiEvent.PrepareSkipped -> Unit
        }
    }

    fun onVideoPlaybackStarted(fileId: Int?) {
        if (fileId != null && fileId == lastCurrentVideoFileId) {
            if (fileId in bypassLocalTranscodeFileIds) {
                playedDuringCurrentVisitFileIds.add(fileId)
            }
        }
        viewModelScope.launch(Dispatchers.IO) {
            videoTranscodeCoordinator.setCurrentlyPlayingFileId(fileId)
        }
    }

    fun onVideoPlaybackIdle(previousFileId: Int?) {
        viewModelScope.launch(Dispatchers.IO) {
            videoTranscodeCoordinator.notifyPlaybackIdle(previousFileId)
        }
    }

    fun validateDeviceKey(deviceKey: String) {
        validateJob?.cancel()
        validateJob = viewModelScope.launch {
            try {
                val response = apiService.validateDeviceKey(deviceKey)
                if (response.isSuccessful) {
                    _deviceValidationResult.value = response.body()
                    _deviceValidationError.value = null
                } else {
                    _deviceValidationResult.value = null
                    _deviceValidationError.value = "Server error: ${response.code()}"
                }
            } catch (e: Exception) {
                _deviceValidationResult.value = null
                _deviceValidationError.value = e.message ?: "Unknown error"
            }
        }
    }

    fun cancelValidateDeviceKey() {
        validateJob?.cancel()
        validateJob = null
    }

    fun fetchPlaylist(deviceKey: String) {
        Log.d("TAG", "fetchPlaylist: ")
        viewModelScope.launch {
            try {
                val response = apiService.getActivePlaylist(deviceKey)
                if (response.isSuccessful) {
                    val body = response.body()
                    _playlistResult.value = body
                    _playlistError.value = null
                    viewModelScope.launch {
                        withContext(Dispatchers.IO) {
                            videoAssetSyncCoordinator.sync(body?.playlist)
                        }
                    }
                } else {
                    _playlistResult.value = null
                    _playlistError.value = "Server error: ${response.code()}"
                }
            } catch (e: Exception) {
                _playlistResult.value = null
                _playlistError.value = e.message ?: "Unknown error"
            }
        }
    }

    fun prioritizeVideoDownload(playlist: Playlist?, fileId: Int?) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                videoAssetSyncCoordinator.prioritizeDownloads(playlist, fileId)
            }
        }
    }

    fun sendHeartbeat(deviceKey: String) {
        viewModelScope.launch {
            try {
                val response = apiService.sendHeartbeat(deviceKey)
                if (response.isSuccessful) {
                    _heartbeatError.value = null
                } else {
                    Log.w("MainViewModel", "Heartbeat failed: ${response.code()}")
                    _heartbeatError.value = "Heartbeat failed (${response.code()})"
                }
            } catch (e: Exception) {
                Log.w("MainViewModel", "Heartbeat error: ${e.message}")
                _heartbeatError.value = e.message ?: "Heartbeat error"
            }
        }
    }

    fun startHeartbeat(deviceKey: String) {
        stopHeartbeat()
        heartbeatJob = viewModelScope.launch {
            sendHeartbeat(deviceKey)
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                if (isActive) sendHeartbeat(deviceKey)
            }
        }
    }

    fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }
}
