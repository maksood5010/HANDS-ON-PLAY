package com.hoi.player.viewmodel

sealed class AppUpdateUiState {
    data object Idle : AppUpdateUiState()
    data object StoppingPlayback : AppUpdateUiState()
    data class Downloading(val percent: Int) : AppUpdateUiState()
    data object Installing : AppUpdateUiState()
    data class Error(val message: String) : AppUpdateUiState()
    /** Install succeeded; OS typically restarts the app process shortly after. */
    data object Complete : AppUpdateUiState()

    fun shouldPausePlayback(): Boolean = when (this) {
        is Idle, is Error, is Complete -> false
        else -> true
    }
}
