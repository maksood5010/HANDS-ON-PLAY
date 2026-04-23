package com.hoi.player.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_LOCKED_BOOT_COMPLETED) return

        val serviceIntent = Intent(context, BootForegroundService::class.java)
            .putExtra(BootForegroundService.EXTRA_BOOT_ACTION, action)
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}

