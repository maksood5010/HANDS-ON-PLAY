package com.hoi.player.mqtt

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.core.content.ContextCompat
import com.hivemq.client.mqtt.MqttClient
import com.hivemq.client.mqtt.datatypes.MqttQos
import com.hivemq.client.mqtt.mqtt3.Mqtt3AsyncClient
import com.hoi.player.network.ConnectivityRestoreMonitor
import com.hoi.player.utils.Constants
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class MqttConnectionManager @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val mqttConfig: MqttConfig
) {
    private val _connectionState = MutableStateFlow(MqttConnectionState.DISCONNECTED)
    val connectionState: StateFlow<MqttConnectionState> = _connectionState.asStateFlow()

    private var client: Mqtt3AsyncClient? = null
    private var registeredDeviceKey: String? = null
    private val connectInFlight = AtomicBoolean(false)
    private var connectivityReceiverRegistered = false
    private val messageListeners = CopyOnWriteArrayList<(String, String) -> Unit>()
    private val subscribedTopics = mutableSetOf<String>()

    private val connectivityReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Constants.ACTION_CONNECTIVITY_RESTORED) {
                Log.i(TAG, "WiFi restored — retrying MQTT connect")
                connectWhenNetworkReady()
            }
        }
    }

    fun connectWhenNetworkReady(deviceKey: String? = null) {
        val key = deviceKey?.trim()?.takeIf { it.isNotEmpty() } ?: registeredDeviceKey
        if (key.isNullOrEmpty()) {
            Log.d(TAG, "connectWhenNetworkReady: skipped (no device_key)")
            _connectionState.value = MqttConnectionState.DISCONNECTED
            return
        }
        registeredDeviceKey = key

        if (!ConnectivityRestoreMonitor.isWifiValidated(appContext)) {
            ensureConnectivityReceiverRegistered()
            _connectionState.value = MqttConnectionState.WAITING_FOR_WIFI
            Log.i(TAG, "connectWhenNetworkReady: waiting for validated WiFi (device=${key.take(8)}…)")
            return
        }

        if (_connectionState.value == MqttConnectionState.CONNECTED && client != null) {
            subscribeDeviceInboundTopicsIfNeeded(client!!, key)
            Log.d(TAG, "connectWhenNetworkReady: already connected")
            return
        }

        if (!connectInFlight.compareAndSet(false, true)) {
            Log.d(TAG, "connectWhenNetworkReady: connect already in flight")
            return
        }

        val endpoint = mqttConfig.parseBrokerEndpoint()
        if (endpoint == null) {
            connectInFlight.set(false)
            _connectionState.value = MqttConnectionState.ERROR
            Log.e(TAG, "connectWhenNetworkReady: invalid broker URL=${mqttConfig.brokerUrl}")
            return
        }

        val clientId = mqttConfig.clientId(key)
        val useAuth = !mqttConfig.username.isNullOrEmpty()
        Log.i(
            TAG,
            "connectWhenNetworkReady: connecting to ${endpoint.host}:${endpoint.port} " +
                "tls=${endpoint.useTls} auth=$useAuth clientId=$clientId prefix=${mqttConfig.topicPrefix}"
        )

        _connectionState.value = MqttConnectionState.CONNECTING
        disconnectInternal(notifyState = false)

        try {
            val builder = MqttClient.builder()
                .useMqttVersion3()
                .identifier(clientId)
                .serverHost(endpoint.host)
                .serverPort(endpoint.port)
                .automaticReconnectWithDefaultConfig()

            if (endpoint.useTls) {
                builder.sslWithDefaultConfig()
            }

            val asyncClient = builder.buildAsync()
            client = asyncClient

            val connectBuilder = asyncClient.connectWith()
                .cleanSession(true)
                .keepAlive(KEEP_ALIVE_SECONDS)

            val username = mqttConfig.username
            if (!username.isNullOrEmpty()) {
                connectBuilder.simpleAuth()
                    .username(username)
                    .password(
                        mqttConfig.password?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)
                    )
                    .applySimpleAuth()
            }

            connectBuilder.send().whenComplete { _, throwable ->
                connectInFlight.set(false)
                if (throwable != null) {
                    Log.e(
                        TAG,
                        "MQTT connect failed (${endpoint.host}:${endpoint.port}): ${throwable.message}",
                        throwable
                    )
                    _connectionState.value = MqttConnectionState.ERROR
                } else {
                    Log.i(
                        TAG,
                        "MQTT connected (${endpoint.host}:${endpoint.port}) state=${MqttConnectionState.CONNECTED}"
                    )
                    _connectionState.value = MqttConnectionState.CONNECTED
                    subscribeDeviceInboundTopicsIfNeeded(asyncClient, key)
                }
            }
        } catch (e: Exception) {
            connectInFlight.set(false)
            Log.e(TAG, "MQTT connect error: ${e.message}", e)
            _connectionState.value = MqttConnectionState.ERROR
        }
    }

    suspend fun publish(topic: String, payloadUtf8: String, qos: MqttQos = MqttQos.AT_LEAST_ONCE): Result<Unit> {
        val active = client
        val state = _connectionState.value
        if (active == null || state != MqttConnectionState.CONNECTED) {
            Log.w(TAG, "publish skipped: not connected (state=$state, client=${active != null})")
            return Result.failure(IllegalStateException("MQTT not connected (state=$state)"))
        }

        return suspendCancellableCoroutine { cont ->
            active.publishWith()
                .topic(topic)
                .qos(qos)
                .payload(payloadUtf8.toByteArray(Charsets.UTF_8))
                .send()
                .whenComplete { _, throwable ->
                    if (throwable != null) {
                        Log.e(TAG, "publish failed: topic=$topic — ${throwable.message}", throwable)
                        if (cont.isActive) cont.resume(Result.failure(throwable))
                    } else {
                        Log.i(TAG, "publish ok: topic=$topic message=$payloadUtf8")
                        if (cont.isActive) cont.resume(Result.success(Unit))
                    }
                }
        }
    }

    fun addMessageListener(listener: (String, String) -> Unit) {
        messageListeners.add(listener)
    }

    fun removeMessageListener(listener: (String, String) -> Unit) {
        messageListeners.remove(listener)
    }

    fun disconnect() {
        Log.i(TAG, "disconnect: tearing down MQTT client")
        registeredDeviceKey = null
        subscribedTopics.clear()
        messageListeners.clear()
        disconnectInternal(notifyState = true)
        unregisterConnectivityReceiver()
    }

    private fun subscribeDeviceInboundTopicsIfNeeded(active: Mqtt3AsyncClient, deviceKey: String) {
        val prefix = mqttConfig.topicPrefix
        val topics = listOf(
            MqttTopics.deviceStatusRequestTopic(prefix, deviceKey),
            MqttTopics.deviceCommandsSubscriptionFilter(prefix, deviceKey),
            MqttTopics.fleetCommandsSubscriptionFilter(prefix)
        )
        topics.forEach { topic -> subscribeTopicIfNeeded(active, topic) }
    }

    private fun subscribeTopicIfNeeded(active: Mqtt3AsyncClient, topic: String) {
        synchronized(subscribedTopics) {
            if (subscribedTopics.contains(topic)) return
        }
        active.subscribeWith()
            .topicFilter(topic)
            .qos(MqttQos.AT_LEAST_ONCE)
            .callback { publish ->
                val publishTopic = publish.topic.toString()
                val payload = String(publish.payloadAsBytes, Charsets.UTF_8)
                messageListeners.forEach { listener ->
                    try {
                        listener(publishTopic, payload)
                    } catch (e: Exception) {
                        Log.w(TAG, "message listener error: ${e.message}")
                    }
                }
            }
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e(TAG, "subscribe failed: topic=$topic — ${throwable.message}", throwable)
                } else {
                    synchronized(subscribedTopics) {
                        subscribedTopics.add(topic)
                    }
                    Log.i(TAG, "subscribed: $topic")
                }
            }
    }

    private fun disconnectInternal(notifyState: Boolean) {
        val active = client
        client = null
        subscribedTopics.clear()
        if (active != null) {
            Log.d(TAG, "disconnectInternal: closing client (notifyState=$notifyState)")
            try {
                active.disconnect().whenComplete { _, throwable ->
                    if (throwable != null) {
                        Log.w(TAG, "disconnect async error: ${throwable.message}")
                    } else {
                        Log.d(TAG, "disconnect async complete")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "disconnect error: ${e.message}")
            }
        }
        if (notifyState) {
            _connectionState.value = MqttConnectionState.DISCONNECTED
            Log.d(TAG, "connection state -> DISCONNECTED")
        }
    }

    private fun ensureConnectivityReceiverRegistered() {
        if (connectivityReceiverRegistered) return
        val filter = IntentFilter(Constants.ACTION_CONNECTIVITY_RESTORED)
        ContextCompat.registerReceiver(
            appContext,
            connectivityReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        connectivityReceiverRegistered = true
    }

    private fun unregisterConnectivityReceiver() {
        if (!connectivityReceiverRegistered) return
        try {
            appContext.unregisterReceiver(connectivityReceiver)
        } catch (_: Exception) {
        }
        connectivityReceiverRegistered = false
    }

    companion object {
        private const val TAG = "MqttConnectionManager"
        private const val KEEP_ALIVE_SECONDS = 60
        private const val LOG_PAYLOAD_MAX_LEN = 256

        private fun truncateForLog(text: String): String =
            if (text.length <= LOG_PAYLOAD_MAX_LEN) text else text.take(LOG_PAYLOAD_MAX_LEN) + "…"
    }
}
