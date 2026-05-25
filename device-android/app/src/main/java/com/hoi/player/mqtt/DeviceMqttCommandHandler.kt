package com.hoi.player.mqtt

/**
 * Handles one or more command topics under …/devices/{key}/commands/… or …/devices/all/commands/….
 * Register implementations on [DeviceMqttCommandDispatcher].
 */
interface DeviceMqttCommandHandler {
    fun handles(topic: String, topicPrefix: String, deviceKey: String): Boolean
    fun onCommand(topic: String, payload: String)
}
