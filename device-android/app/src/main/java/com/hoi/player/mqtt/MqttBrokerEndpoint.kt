package com.hoi.player.mqtt

data class MqttBrokerEndpoint(
    val host: String,
    val port: Int,
    val useTls: Boolean
)
