package com.hoi.player.update

import com.hoi.player.BuildConfig
import com.hoi.player.mqtt.MqttConfig
import com.hoi.player.mqtt.MqttConnectionManager
import com.hoi.player.mqtt.MqttTopics
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateSuccessPublisher @Inject constructor(
    private val mqttConnectionManager: MqttConnectionManager,
    private val mqttConfig: MqttConfig
) {
    suspend fun publishSuccess(deviceKey: String): Result<Unit> {
        val payload = JSONObject()
            .put("device_key", deviceKey)
            .put("status", "success")
            .put("app_version", BuildConfig.VERSION_NAME)
            .put("version_code", BuildConfig.VERSION_CODE)
            .toString()

        val topic = MqttTopics.deviceCommandsUpdateSuccessTopic(mqttConfig.topicPrefix, deviceKey)
        return withTimeout(PUBLISH_TIMEOUT_MS) {
            mqttConnectionManager.publish(topic, payload)
        }
    }

    companion object {
        private const val PUBLISH_TIMEOUT_MS = 10_000L
    }
}
