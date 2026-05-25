package com.hoi.player.heartbeat

import android.util.Log
import com.hoi.player.mqtt.MqttConnectionManager
import com.hoi.player.mqtt.MqttConnectionState
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceHeartbeatScheduler @Inject constructor(
    private val deviceHeartbeatRepository: DeviceHeartbeatRepository,
    private val mqttConnectionManager: MqttConnectionManager
) {
    private var heartbeatJob: Job? = null

    fun start(scope: CoroutineScope) {
        if (heartbeatJob?.isActive == true) {
            Log.d(TAG, "start: heartbeat loop already running")
            return
        }
        Log.i(TAG, "start: heartbeat loop every ${HEARTBEAT_INTERVAL_MS / 1000}s")
        heartbeatJob = scope.launch(Dispatchers.IO) {
            tick()
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                tick()
            }
        }
    }

    fun stop() {
        if (heartbeatJob?.isActive == true) {
            Log.i(TAG, "stop: cancelling heartbeat loop")
        }
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private suspend fun tick() {
        val deviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY)?.trim().orEmpty()
        if (deviceKey.isEmpty()) {
            Log.d(TAG, "tick: skipped (no device_key in prefs)")
            return
        }

        val state = mqttConnectionManager.connectionState.value
        if (state != MqttConnectionState.CONNECTED) {
            Log.d(TAG, "tick: MQTT not connected (state=$state), requesting connect")
            mqttConnectionManager.connectWhenNetworkReady(deviceKey)
            return
        }

        deviceHeartbeatRepository.publish(deviceKey)

    }

    companion object {
        private const val TAG = "DeviceHeartbeatScheduler"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }
}
