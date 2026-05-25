package com.hoi.player.mqtt

import android.content.Context
import android.content.Intent
import android.util.Log
import com.hoi.player.MainActivity
import com.hoi.player.assets.ExoCacheCleaner
import com.hoi.player.assets.VideoAssetStore
import com.hoi.player.heartbeat.DeviceStatusPayloadBuilder
import com.hoi.player.utils.Constants
import com.hoi.player.utils.KioskUtil
import com.hoi.player.utils.PreferencesManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceRecoveryCommandHandler @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val mqttConnectionManager: MqttConnectionManager,
    private val mqttConfig: MqttConfig,
    private val statusPayloadBuilder: DeviceStatusPayloadBuilder,
    private val videoAssetStore: VideoAssetStore,
    private val exoCacheCleaner: ExoCacheCleaner
) : DeviceMqttCommandHandler {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun handles(topic: String, topicPrefix: String, deviceKey: String): Boolean =
        topic == MqttTopics.deviceCommandsTopic(topicPrefix, deviceKey)

    override fun onCommand(topic: String, payload: String) {
        val (command, args) = parseMqttCommandPayload(payload)
        if (command.isEmpty()) {
            Log.w(TAG, "ignored empty command on $topic")
            return
        }
        Log.i(TAG, "recovery command: $command topic=$topic")
        scope.launch {
            try {
                execute(command, args)
            } catch (e: Exception) {
                Log.e(TAG, "recovery command failed: $command — ${e.message}", e)
            }
        }
    }

    private suspend fun execute(command: String, args: String?) {
        when (command) {
            CMD_REFRESH_PLAYLIST -> {
                sendAppBroadcast(Constants.ACTION_PLAYLIST_REFRESH)
                Log.i(TAG, "$CMD_REFRESH_PLAYLIST: broadcast sent")
            }
            CMD_RESTART_PLAYBACK -> {
                sendAppBroadcast(Constants.ACTION_RESTART_PLAYBACK)
                Log.i(TAG, "$CMD_RESTART_PLAYBACK: broadcast sent")
            }
            CMD_STATUS -> publishStatus()
            CMD_CLEAR_CACHE -> clearCacheAndRefresh()
            CMD_LAUNCH_APP -> launchApp()
            CMD_RESTART_APP -> {
                Log.i(TAG, "$CMD_RESTART_APP: restarting app process")
                KioskUtil.restartApp(appContext)
            }
            CMD_REBOOT_DEVICE -> KioskUtil.rebootDevice(appContext)
            CMD_SET_DEVICE_OWNER -> KioskUtil.setDeviceOwner(appContext)
            CMD_REMOVE_DEVICE_OWNER -> {
                KioskUtil.removeDeviceOwner(appContext)
                Log.i(TAG, "$CMD_REMOVE_DEVICE_OWNER: completed")
            }
            CMD_RUN_ADB_COMMAND -> runAdb(args)
            else -> Log.w(TAG, "unknown recovery command: $command")
        }
    }

    private suspend fun publishStatus() {
        val deviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY)?.trim().orEmpty()
        if (deviceKey.isEmpty()) {
            Log.w(TAG, "$CMD_STATUS: no device_key in prefs")
            return
        }
        val json = statusPayloadBuilder.buildJson(deviceKey)
        val responseTopic = MqttTopics.deviceStatusResponseTopic(mqttConfig.topicPrefix, deviceKey)
        mqttConnectionManager.publish(responseTopic, json)
            .onSuccess { Log.i(TAG, "$CMD_STATUS: published to $responseTopic") }
            .onFailure { e -> Log.w(TAG, "$CMD_STATUS: publish failed — ${e.message}") }
    }

    private fun clearCacheAndRefresh() {
        val manifest = videoAssetStore.readManifest()
        exoCacheCleaner.removeEntries(manifest.videos)
        exoCacheCleaner.clearAll()
        videoAssetStore.deleteAllAssets()
        sendAppBroadcast(Constants.ACTION_PLAYLIST_REFRESH)
        Log.i(TAG, "$CMD_CLEAR_CACHE: cache cleared, playlist refresh broadcast sent")
    }

    private fun launchApp() {
        val intent = Intent(appContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try {
            appContext.startActivity(intent)
            Log.i(TAG, "$CMD_LAUNCH_APP: MainActivity started")
        } catch (e: Exception) {
            Log.e(TAG, "$CMD_LAUNCH_APP failed: ${e.message}", e)
        }
    }

    private fun runAdb(args: String?) {
        if (args.isNullOrBlank()) {
            Log.w(TAG, "$CMD_RUN_ADB_COMMAND: missing shell command (use two-line payload)")
            return
        }
        val output = KioskUtil.adbCommand(args)
        Log.i(
            TAG,
            "$CMD_RUN_ADB_COMMAND: shell=$args output=${output?.trim().orEmpty().ifEmpty { "(empty)" }}"
        )
    }

    private fun sendAppBroadcast(action: String) {
        val intent = Intent(action).apply {
            setPackage(appContext.packageName)
        }
        appContext.sendBroadcast(intent)
    }

    companion object {
        private const val TAG = "DeviceRecoveryCmdHandler"

        const val CMD_REFRESH_PLAYLIST = "refresh-playlist"
        const val CMD_RESTART_PLAYBACK = "restart-playback"
        const val CMD_STATUS = "status"
        const val CMD_CLEAR_CACHE = "clear-cache"
        const val CMD_LAUNCH_APP = "launch-app"
        const val CMD_RESTART_APP = "restart-app"
        const val CMD_REBOOT_DEVICE = "reboot-device"
        const val CMD_SET_DEVICE_OWNER = "set-device-owner"
        const val CMD_REMOVE_DEVICE_OWNER = "remove-device-owner"
        const val CMD_RUN_ADB_COMMAND = "run-adb-command"
    }
}
