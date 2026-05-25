package com.hoi.player.heartbeat

import android.util.Log
import com.hoi.player.mqtt.MqttConfig
import com.hoi.player.mqtt.MqttConnectionManager
import com.hoi.player.mqtt.MqttTopics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceStatusResponder @Inject constructor(
    private val mqttConnectionManager: MqttConnectionManager,
    private val payloadBuilder: DeviceStatusPayloadBuilder,
    private val mqttConfig: MqttConfig
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var activeDeviceKey: String? = null

    private val messageListener: (String, String) -> Unit = { topic, _ ->
        handleStatusRequest(topic)
    }

    fun start(deviceKey: String) {
        val key = deviceKey.trim()
        if (key.isEmpty()) return
        activeDeviceKey = key
        mqttConnectionManager.addMessageListener(messageListener)
        Log.i(TAG, "start: listening for status requests (device=${key.take(8)}…)")
    }

    fun stop() {
        mqttConnectionManager.removeMessageListener(messageListener)
        activeDeviceKey = null
        Log.i(TAG, "stop: status request listener removed")
    }

    private fun handleStatusRequest(topic: String) {
        val key = activeDeviceKey ?: return
        val expectedTopic = MqttTopics.deviceStatusRequestTopic(mqttConfig.topicPrefix, key)
        if (topic != expectedTopic) return

        scope.launch {
            val json = payloadBuilder.buildJson(key)
            val responseTopic = MqttTopics.deviceStatusResponseTopic(mqttConfig.topicPrefix, key)
            val result = mqttConnectionManager.publish(responseTopic, json)
            result.onSuccess {
                Log.d(TAG, "status response published for device=${key.take(8)}…")
            }.onFailure { e ->
                Log.w(TAG, "status response publish failed: ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "DeviceStatusResponder"
    }
}
