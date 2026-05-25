package com.hoi.player.mqtt

enum class MqttConnectionState {
    DISCONNECTED,
    WAITING_FOR_WIFI,
    CONNECTING,
    CONNECTED,
    ERROR
}
