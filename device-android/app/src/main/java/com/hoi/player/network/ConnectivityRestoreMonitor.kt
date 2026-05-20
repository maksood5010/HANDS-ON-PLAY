package com.hoi.player.network

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.hoi.player.utils.Constants

/**
 * Observes validated WiFi transitions and broadcasts when connectivity is restored
 * after being unavailable.
 */
class ConnectivityRestoreMonitor(private val appContext: Context) {

    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var hadValidatedWifi = false
    private var lastBroadcastAtMs = 0L
    private var started = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            updateWifiState()
        }

        override fun onLost(network: Network) {
            hadValidatedWifi = false
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            updateWifiState()
        }
    }

    fun start() {
        if (started) return
        started = true
        hadValidatedWifi = isWifiValidated(appContext)
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register network callback", e)
            val request = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .build()
            connectivityManager.registerNetworkCallback(request, networkCallback)
        }
    }

    fun stop() {
        if (!started) return
        started = false
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to unregister network callback", e)
        }
    }

    private fun updateWifiState() {
        val now = isWifiValidated(appContext)
        if (now && !hadValidatedWifi) {
            hadValidatedWifi = true
            maybeSendRestoredBroadcast()
        } else if (!now) {
            hadValidatedWifi = false
        }
    }

    private fun maybeSendRestoredBroadcast() {
        val nowMs = System.currentTimeMillis()
        if (nowMs - lastBroadcastAtMs < DEBOUNCE_MS) return
        lastBroadcastAtMs = nowMs

        mainHandler.post {
            val intent = Intent(Constants.ACTION_CONNECTIVITY_RESTORED).apply {
                setPackage(appContext.packageName)
            }
            appContext.sendBroadcast(intent)
            Log.d(TAG, "Sent ${Constants.ACTION_CONNECTIVITY_RESTORED}")
        }
    }

    companion object {
        private const val TAG = "ConnectivityRestoreMonitor"
        private const val DEBOUNCE_MS = 3_000L

        fun isWifiValidated(context: Context): Boolean {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }
    }
}
