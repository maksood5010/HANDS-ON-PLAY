package com.hoi.player.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.hoi.player.R
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager

class DisplayFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("DisplayFirebaseMessagingService", "onNewToken received token=${token.take(12)}…")

        // Best-effort: re-subscribe after token rotation.
        val topic = PreferencesManager.get<String>(Constants.PREF_FCM_TOPIC)
        if (!topic.isNullOrBlank()) {
            FirebaseMessaging.getInstance()
                .subscribeToTopic(topic)
                .addOnCompleteListener { task ->
                    Log.d("DisplayFirebaseMessagingService", "re-subscribeToTopic($topic) success=${task.isSuccessful}")
                }
        } else {
            Log.w("DisplayFirebaseMessagingService", "No saved group topic in prefs (${Constants.PREF_FCM_TOPIC})")
        }

        val companyId = PreferencesManager.get<String>(Constants.PREF_COMPANY_ID)
        if (!companyId.isNullOrBlank()) {
            val companyTopic = "c_${companyId}_all"
            FirebaseMessaging.getInstance()
                .subscribeToTopic(companyTopic)
                .addOnCompleteListener { task ->
                    Log.d(
                        "DisplayFirebaseMessagingService",
                        "re-subscribeToTopic($companyTopic) success=${task.isSuccessful}"
                    )
                }
        } else {
            Log.w("DisplayFirebaseMessagingService", "No saved company id in prefs (${Constants.PREF_COMPANY_ID})")
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(
            "DisplayFirebaseMessagingService",
            "onMessageReceived from=${message.from} data=${message.data} notification=${message.notification?.title}/${message.notification?.body}"
        )

        // Debug helper: show an on-device notification so receipt is visible.
        // If notifications are blocked on the device (Android 13+ runtime permission),
        // logcat will still show the message when it arrives.
        showDebugNotification(message)

        val intent = Intent(Constants.ACTION_PLAYLIST_REFRESH).apply {
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun showDebugNotification(message: RemoteMessage) {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val existing = manager.getNotificationChannel(DEBUG_CHANNEL_ID)
        if (existing == null) {
            val channel = NotificationChannel(
                DEBUG_CHANNEL_ID,
                "Playlist debug",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            manager.createNotificationChannel(channel)
        }

        val title = "Playlist refresh received"
        val body = message.data.entries.joinToString(separator = " ") { "${it.key}=${it.value}" }
            .ifBlank { message.notification?.body ?: "(no payload)" }

        val notification = NotificationCompat.Builder(this, DEBUG_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body.take(120))
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .build()

        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }

    companion object {
        private const val DEBUG_CHANNEL_ID = "playlist_debug"
    }
}

