package com.hoi.player.push

import android.content.Intent
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager

class DisplayFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("DisplayFirebaseMessagingService", "onNewToken received")

        // Best-effort: re-subscribe after token rotation.
        val topic = PreferencesManager.get<String>(Constants.PREF_FCM_TOPIC)
        if (!topic.isNullOrBlank()) {
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .subscribeToTopic(topic)
                .addOnCompleteListener { task ->
                    Log.d("DisplayFirebaseMessagingService", "re-subscribeToTopic($topic) success=${task.isSuccessful}")
                }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val type = message.data["type"]
        Log.d("DisplayFirebaseMessagingService", "onMessageReceived data=${message.data}")
        if (type == "playlist_refresh") {
            val intent = Intent(Constants.ACTION_PLAYLIST_REFRESH).apply {
                setPackage(packageName)
            }
            sendBroadcast(intent)
        }
    }
}

