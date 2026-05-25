package com.hoi.player.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoi.player.update.AppUpdateRepository
import com.hoi.player.update.AppUpdateUrlValidator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val appUpdateRepository: AppUpdateRepository
) : ViewModel() {

    private val _updateUiState = MutableLiveData<AppUpdateUiState>(AppUpdateUiState.Idle)
    val updateUiState: LiveData<AppUpdateUiState> = _updateUiState

    init {
        viewModelScope.launch {
            appUpdateRepository.uiState.collect { state ->
                _updateUiState.postValue(state)
            }
        }
    }

    fun onUpdateRequested(url: String) {
        val validated = AppUpdateUrlValidator.validate(url)
        if (validated == null) {
            _updateUiState.value = AppUpdateUiState.Error("Invalid update URL")
            return
        }
        appUpdateRepository.startUpdate(validated)
    }

    fun onInstallResult(status: Int, message: String?) {
        appUpdateRepository.onInstallResult(status, message)
    }

    fun clearUpdateError() {
        appUpdateRepository.resetToIdle()
    }
}
