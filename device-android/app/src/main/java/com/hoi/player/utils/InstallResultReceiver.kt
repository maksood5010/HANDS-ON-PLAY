package com.hoi.player.utils

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log
import com.hoi.player.di.AppEntryPoint
import dagger.hilt.android.EntryPointAccessors

class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val repository = EntryPointAccessors.fromApplication(
            context.applicationContext,
            AppEntryPoint::class.java
        ).appUpdateRepository()

        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)) {
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i(TAG, "Installation success")
                repository.onInstallResult(status, null)
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                launchIntent?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    context.startActivity(this)
                }
            }
            PackageInstaller.STATUS_FAILURE -> {
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                Log.e(TAG, "Installation failed: $message")
                repository.onInstallResult(status, message)
            }
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                Log.i(TAG, "Installation pending user action")
                @Suppress("DEPRECATION")
                val confirmIntent = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(confirmIntent)
                } else {
                    repository.onInstallResult(
                        PackageInstaller.STATUS_FAILURE,
                        "Install requires user confirmation"
                    )
                }
            }
            else -> {
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                Log.e(TAG, "Installation failed (status=$status): $message")
                repository.onInstallResult(
                    status,
                    message ?: "Install failed ($status)"
                )
            }
        }
    }

    companion object {
        private const val TAG = "InstallResultReceiver"
    }
}
