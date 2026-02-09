package com.hoi.player.utils

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.widget.Toast

class MyDeviceAdminReceiver: DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Toast.makeText(context, "Admin Enabled", Toast.LENGTH_SHORT).show()
        super.onEnabled(context, intent)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        Toast.makeText(context, "Admin Disabled", Toast.LENGTH_SHORT).show()
        super.onDisabled(context, intent)
    }

}