package com.hoi.player.boot

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import com.hoi.player.MainActivity
import com.hoi.player.heartbeat.DeviceHeartbeatScheduler
import com.hoi.player.heartbeat.DeviceStatusResponder
import com.hoi.player.mqtt.DeviceMqttCommandDispatcher
import com.hoi.player.mqtt.MqttConnectionManager
import com.hoi.player.mqtt.MqttConnectionState
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BootForegroundService : Service() {

    @Inject lateinit var mqttConnectionManager: MqttConnectionManager
    @Inject lateinit var deviceHeartbeatScheduler: DeviceHeartbeatScheduler
    @Inject lateinit var deviceStatusResponder: DeviceStatusResponder
    @Inject lateinit var deviceMqttCommandDispatcher: DeviceMqttCommandDispatcher

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(serviceJob + Dispatchers.Main.immediate)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(
            BootNotifications.notificationId(),
            BootNotifications.foregroundNotification(this, MqttConnectionState.DISCONNECTED)
        )

        serviceScope.launch {
            mqttConnectionManager.connectionState.collectLatest { state ->
                val notification = BootNotifications.foregroundNotification(this@BootForegroundService, state)
                val manager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
                manager.notify(BootNotifications.notificationId(), notification)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Open UI only after BOOT_COMPLETED (BootReceiver). Do not relaunch when
        // SetupDeviceFragment / MainActivity call startIfNeeded() for MQTT only.
        val bootAction = intent?.getStringExtra(EXTRA_BOOT_ACTION)
        if (bootAction == Intent.ACTION_BOOT_COMPLETED) {
            try {
                val activityIntent = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                startActivity(activityIntent)
            } catch (_: Throwable) {
            }
        }

        val deviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY)?.trim().orEmpty()
        if (deviceKey.isNotEmpty()) {
            Log.i(
                TAG,
                "onStartCommand: bootAction=$bootAction — start MQTT + heartbeat (device=${deviceKey.take(8)}…)"
            )
            mqttConnectionManager.connectWhenNetworkReady(deviceKey)
            deviceStatusResponder.start(deviceKey)
            deviceMqttCommandDispatcher.start(deviceKey)
            deviceHeartbeatScheduler.start(serviceScope)
        } else {
            Log.d(TAG, "onStartCommand: no device_key; MQTT heartbeat not started")
        }

        return START_STICKY
    }

    override fun onDestroy() {
        deviceHeartbeatScheduler.stop()
        deviceStatusResponder.stop()
        deviceMqttCommandDispatcher.stop()
        mqttConnectionManager.disconnect()
        serviceScope.cancel()
        serviceJob.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "BootForegroundService"
        const val EXTRA_BOOT_ACTION = "extra_boot_action"
        private const val ACTION_START_CONNECTIVITY = "com.hoi.player.action.START_DEVICE_CONNECTIVITY"

        /** Starts MQTT/heartbeat foreground work without launching MainActivity. */
        fun startIfNeeded(context: Context) {
            val intent = Intent(context, BootForegroundService::class.java)
                .setAction(ACTION_START_CONNECTIVITY)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
