package com.hoi.player.boot

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.hoi.player.MainActivity
import com.hoi.player.R
import com.hoi.player.mqtt.MqttConnectionState

internal object BootNotifications {
    private const val CHANNEL_ID = "device_connectivity"
    private const val CHANNEL_NAME = "Device connectivity"
    private const val NOTIFICATION_ID = 1001

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        )
        manager.createNotificationChannel(channel)
    }

    fun foregroundNotification(context: Context, mqttState: MqttConnectionState): Notification {
        ensureChannel(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = when (mqttState) {
            MqttConnectionState.CONNECTED -> "Connected to MQTT"
            MqttConnectionState.CONNECTING -> "Connecting to MQTT…"
            MqttConnectionState.WAITING_FOR_WIFI -> "Waiting for WiFi…"
            MqttConnectionState.ERROR -> "MQTT connection error"
            MqttConnectionState.DISCONNECTED -> "Device service running"
        }

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(statusText)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setContentIntent(openPendingIntent)
            .build()
    }

    fun notificationId(): Int = NOTIFICATION_ID
}
