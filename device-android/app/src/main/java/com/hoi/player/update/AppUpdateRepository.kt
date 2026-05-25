package com.hoi.player.update

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageInstaller
import android.util.Log
import com.hoi.player.utils.Constants
import com.hoi.player.utils.KioskUtil
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.viewmodel.AppUpdateUiState
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateRepository @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val apkDownloader: ApkDownloader,
    private val successPublisher: AppUpdateSuccessPublisher
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val updateInFlight = AtomicBoolean(false)

    private val _uiState = MutableStateFlow<AppUpdateUiState>(AppUpdateUiState.Idle)
    val uiState: StateFlow<AppUpdateUiState> = _uiState.asStateFlow()

    fun startUpdate(url: String) {
        val validated = AppUpdateUrlValidator.validate(url)
        if (validated == null) {
            Log.w(TAG, "startUpdate: invalid URL")
            _uiState.value = AppUpdateUiState.Error("Invalid update URL")
            return
        }
        if (!updateInFlight.compareAndSet(false, true)) {
            Log.d(TAG, "startUpdate: already in progress")
            return
        }

        scope.launch {
            runUpdate(validated)
        }
    }

    fun onInstallResult(status: Int, message: String?) {
        scope.launch {
            when (status) {
                PackageInstaller.STATUS_SUCCESS -> completeInstallSuccess()
                else -> {
                    val detail = message?.takeIf { it.isNotBlank() } ?: "Install failed ($status)"
                    failUpdate(detail)
                }
            }
        }
    }

    private suspend fun runUpdate(url: String) {
        try {
            _uiState.value = AppUpdateUiState.StoppingPlayback
            kotlinx.coroutines.delay(300)

            val apkFile = File(appContext.cacheDir, "ota_update.apk")
            if (apkFile.exists()) apkFile.delete()

            _uiState.value = AppUpdateUiState.Downloading(0)
            withContext(Dispatchers.IO) {
                apkDownloader.download(url, apkFile) { percent ->
                    _uiState.value = AppUpdateUiState.Downloading(percent)
                }
            }

            if (!isDeviceOwner()) {
                failUpdate("App is not device owner — cannot install silently")
                return
            }

            _uiState.value = AppUpdateUiState.Installing
            withContext(Dispatchers.IO) {
                KioskUtil.install(appContext, apkFile)
            }
        } catch (e: Exception) {
            Log.e(TAG, "runUpdate failed: ${e.message}", e)
            failUpdate(e.message ?: "Update failed")
        }
    }

    private suspend fun completeInstallSuccess() {
        val deviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY)?.trim().orEmpty()
        if (deviceKey.isNotEmpty()) {
            val publishResult = withContext(Dispatchers.IO) {
                successPublisher.publishSuccess(deviceKey)
            }
            publishResult.onFailure { e ->
                Log.w(TAG, "success publish failed: ${e.message}")
            }
        } else {
            Log.w(TAG, "completeInstallSuccess: no device_key; skipping MQTT success")
        }
        _uiState.value = AppUpdateUiState.Idle
        updateInFlight.set(false)
    }

    private fun failUpdate(message: String) {
        _uiState.value = AppUpdateUiState.Error(message)
        updateInFlight.set(false)
    }

    private fun isDeviceOwner(): Boolean {
        val dpm = appContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(appContext.packageName)
    }

    fun resetToIdle() {
        _uiState.value = AppUpdateUiState.Idle
        updateInFlight.set(false)
    }

    companion object {
        private const val TAG = "AppUpdateRepository"
    }
}
