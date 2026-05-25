package com.hoi.player.update

import android.content.Context
import android.content.Intent
import android.util.Log
import com.hoi.player.MainActivity
import com.hoi.player.mqtt.DeviceMqttCommandHandler
import com.hoi.player.mqtt.MqttTopics
import com.hoi.player.utils.Constants
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceUpdateCommandHandler @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val appUpdateRepository: AppUpdateRepository
) : DeviceMqttCommandHandler {

    override fun handles(topic: String, topicPrefix: String, deviceKey: String): Boolean =
        MqttTopics.isCommandsUpdateTopic(topic, topicPrefix, deviceKey)

    override fun onCommand(topic: String, payload: String) {
        val url = AppUpdateUrlValidator.validate(payload) ?: run {
            Log.w(TAG, "ignored invalid update payload on $topic")
            return
        }

        Log.i(TAG, "OTA update command: topic=$topic")
        launchUpdateUi(url)
        appUpdateRepository.startUpdate(url)
    }

    private fun launchUpdateUi(url: String) {
        val intent = Intent(appContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(Constants.EXTRA_APP_UPDATE_URL, url)
        }
        try {
            appContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "launchUpdateUi failed: ${e.message}", e)
        }
    }

    companion object {
        private const val TAG = "DeviceUpdateCmdHandler"
    }
}
