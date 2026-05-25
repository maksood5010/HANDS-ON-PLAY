package com.hoi.player.mqtt

import com.hoi.player.BuildConfig
import com.hoi.player.utils.Constants
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MqttConfig @Inject constructor() {

    val brokerUrl: String
        get() = Constants.mqttBrokerUrl

    val topicPrefix: String
        get() = Constants.mqttTopicPrefix

    val username: String?
        get() = BuildConfig.MQTT_USERNAME.trim().takeIf { it.isNotEmpty() }

    val password: String?
        get() = BuildConfig.MQTT_PASSWORD.trim().takeIf { it.isNotEmpty() }

    fun clientId(deviceKey: String): String =
        "hoi-device-${deviceKey.take(48)}-${UUID.randomUUID().toString().take(8)}"

    fun parseBrokerEndpoint(): MqttBrokerEndpoint? {
        val raw = brokerUrl.trim()
        if (raw.isEmpty()) return null

        val useTls = raw.startsWith("mqtts://", ignoreCase = true)
        val schemeLen = if (useTls) 8 else if (raw.startsWith("mqtt://", ignoreCase = true)) 7 else return null

        val withoutScheme = raw.substring(schemeLen).trim().trimEnd('/')
        if (withoutScheme.isEmpty()) return null

        val host: String
        val port: Int
        val slash = withoutScheme.indexOf('/')
        val authority = if (slash >= 0) withoutScheme.substring(0, slash) else withoutScheme

        val colon = authority.lastIndexOf(':')
        if (colon > 0 && colon < authority.length - 1) {
            val portPart = authority.substring(colon + 1)
            val parsedPort = portPart.toIntOrNull()
            if (parsedPort != null) {
                host = authority.substring(0, colon)
                port = parsedPort
            } else {
                host = authority
                port = defaultPort(useTls)
            }
        } else {
            host = authority
            port = defaultPort(useTls)
        }

        if (host.isEmpty()) return null
        return MqttBrokerEndpoint(host = host, port = port, useTls = useTls)
    }

    private fun defaultPort(useTls: Boolean): Int = if (useTls) 8883 else 1883
}
