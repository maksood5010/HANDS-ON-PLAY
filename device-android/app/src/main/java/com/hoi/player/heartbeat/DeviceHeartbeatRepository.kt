package com.hoi.player.heartbeat

import android.util.Log
import com.hoi.player.mqtt.MqttConnectionManager
import com.hoi.player.mqtt.MqttTopics
import com.hoi.player.utils.Constants
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceHeartbeatRepository @Inject constructor(
    private val mqttConnectionManager: MqttConnectionManager,
    private val appForegroundTracker: AppForegroundTracker
) {

    suspend fun publish(deviceKey: String): Result<Unit> {
        val key = deviceKey.trim()
        if (key.isEmpty()) {
            Log.w(TAG, "publish: skipped (empty device_key)")
            return Result.failure(IllegalArgumentException("device_key is required"))
        }

        val presence = if (appForegroundTracker.isInForeground()) PRESENCE_OPEN else PRESENCE_CLOSED
        val topic = MqttTopics.deviceHeartbeatTopic(Constants.mqttTopicPrefix, key)
        Log.d(TAG, "publish heartbeat: topic=$topic presence=$presence")
        return mqttConnectionManager.publish(topic, presence)
    }

    companion object {
        private const val TAG = "DeviceHeartbeatRepository"
        const val PRESENCE_OPEN = "open"
        const val PRESENCE_CLOSED = "closed"
    }
}
