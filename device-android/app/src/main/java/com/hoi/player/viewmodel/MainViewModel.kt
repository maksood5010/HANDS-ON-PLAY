package com.hoi.player.viewmodel

import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoi.player.models.DisplayPlaylistResponse
import com.hoi.player.models.ValidateDeviceResponse
import com.hoi.player.network.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val HEARTBEAT_INTERVAL_MS = 60_000L

@HiltViewModel
class MainViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private var heartbeatJob: Job? = null
    private var validateJob: Job? = null

    private val _deviceValidationResult = MutableLiveData<ValidateDeviceResponse?>()
    val deviceValidationResult: LiveData<ValidateDeviceResponse?> = _deviceValidationResult

    private val _deviceValidationError = MutableLiveData<String?>()
    val deviceValidationError: LiveData<String?> = _deviceValidationError

    private val _playlistResult = MutableLiveData<DisplayPlaylistResponse?>()
    val playlistResult: LiveData<DisplayPlaylistResponse?> = _playlistResult

    private val _playlistError = MutableLiveData<String?>()
    val playlistError: LiveData<String?> = _playlistError

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
        viewModelScope.launch {
            try {
                val response = apiService.getActivePlaylist(deviceKey)
                if (response.isSuccessful) {
                    _playlistResult.value = response.body()
                    _playlistError.value = null
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

    fun sendHeartbeat(deviceKey: String) {
        viewModelScope.launch {
            try {
                val response = apiService.sendHeartbeat(deviceKey)
                if (!response.isSuccessful) {
                    Log.w("MainViewModel", "Heartbeat failed: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.w("MainViewModel", "Heartbeat error: ${e.message}")
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