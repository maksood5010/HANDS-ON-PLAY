package com.hoi.player.mqtt

import android.util.Log
import com.hoi.player.update.DeviceUpdateCommandHandler
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceMqttCommandDispatcher @Inject constructor(
    private val mqttConnectionManager: MqttConnectionManager,
    private val mqttConfig: MqttConfig,
    recoveryCommandHandler: DeviceRecoveryCommandHandler,
    updateCommandHandler: DeviceUpdateCommandHandler
) {
    private val handlers: List<DeviceMqttCommandHandler> = listOf(
        recoveryCommandHandler,
        updateCommandHandler
    )

    private var activeDeviceKey: String? = null

    private val messageListener: (String, String) -> Unit = { topic, payload ->
        dispatch(topic, payload)
    }

    fun start(deviceKey: String) {
        val key = deviceKey.trim()
        if (key.isEmpty()) return
        activeDeviceKey = key
        mqttConnectionManager.addMessageListener(messageListener)
        Log.i(
            TAG,
            "start: command dispatch active (device=${key.take(8)}…, handlers=${handlers.size})"
        )
    }

    fun stop() {
        mqttConnectionManager.removeMessageListener(messageListener)
        activeDeviceKey = null
        Log.i(TAG, "stop: command dispatch listener removed")
    }

    private fun dispatch(topic: String, payload: String) {
        val key = activeDeviceKey ?: return
        val prefix = mqttConfig.topicPrefix
        if (!MqttTopics.isDeviceCommandTopic(topic, prefix, key) &&
            !MqttTopics.isFleetCommandTopic(topic, prefix)
        ) {
            return
        }

        for (handler in handlers) {
            if (handler.handles(topic, prefix, key)) {
                try {
                    handler.onCommand(topic, payload)
                } catch (e: Exception) {
                    Log.w(TAG, "command handler error: topic=$topic — ${e.message}")
                }
                return
            }
        }
        Log.d(TAG, "no handler for command topic: $topic")
    }

    companion object {
        private const val TAG = "DeviceMqttCmdDispatch"
    }
}
