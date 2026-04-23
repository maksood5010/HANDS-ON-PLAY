package com.hoi.player.boot

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.hoi.player.MainActivity

class BootForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(
            BootNotifications.notificationId(),
            BootNotifications.foregroundNotification(this)
        )

        val bootAction = intent?.getStringExtra(EXTRA_BOOT_ACTION)

        // Best-effort: open UI immediately after boot. Android may block background activity starts
        // for regular apps; the foreground notification (and full-screen intent if allowed) is the fallback.
        if (bootAction != Intent.ACTION_LOCKED_BOOT_COMPLETED) {
            try {
                val activityIntent = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                startActivity(activityIntent)
            } catch (_: Throwable) {
            }
        }

        Handler(Looper.getMainLooper()).postDelayed(
            { stopSelfResult(startId) },
            5_000L
        )

        return START_NOT_STICKY
    }

    companion object {
        const val EXTRA_BOOT_ACTION = "extra_boot_action"
    }
}

