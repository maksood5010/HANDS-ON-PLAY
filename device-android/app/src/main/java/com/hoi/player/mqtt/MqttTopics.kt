package com.hoi.player.mqtt

/**
 * MQTT topic helpers. Device subscribes to [deviceCommandsSubscriptionFilter] and
 * [fleetCommandsSubscriptionFilter]; individual command paths are handled in code.
 */
object MqttTopics {
    fun deviceHeartbeatTopic(topicPrefix: String, deviceKey: String): String =
        deviceTopic(topicPrefix, deviceKey, "heartbeat")

    fun deviceStatusRequestTopic(topicPrefix: String, deviceKey: String): String =
        deviceTopic(topicPrefix, deviceKey, "status/request")

    fun deviceStatusResponseTopic(topicPrefix: String, deviceKey: String): String =
        deviceTopic(topicPrefix, deviceKey, "status/response")

    /** Subscribe filter: all commands for this device (e.g. …/commands/update). */
    fun deviceCommandsSubscriptionFilter(topicPrefix: String, deviceKey: String): String {
        val prefix = normalizedPrefix(topicPrefix)
        return "$prefix/devices/$deviceKey/commands/#"
    }

    /** Subscribe filter: fleet-wide commands (literal segment `all`). */
    fun fleetCommandsSubscriptionFilter(topicPrefix: String): String {
        val prefix = normalizedPrefix(topicPrefix)
        return "$prefix/devices/all/commands/#"
    }

    /** Flat recovery-command topic (payload = command name, e.g. refresh-playlist). */
    fun deviceCommandsTopic(topicPrefix: String, deviceKey: String): String {
        val prefix = normalizedPrefix(topicPrefix)
        return "$prefix/devices/$deviceKey/commands"
    }

    fun deviceCommandsUpdateTopic(topicPrefix: String, deviceKey: String): String =
        deviceTopic(topicPrefix, deviceKey, "commands/update")

    fun fleetCommandsUpdateTopic(topicPrefix: String): String {
        val prefix = normalizedPrefix(topicPrefix)
        return "$prefix/devices/all/commands/update"
    }

    fun deviceCommandsUpdateSuccessTopic(topicPrefix: String, deviceKey: String): String =
        deviceTopic(topicPrefix, deviceKey, "commands/update/success")

    /** True if [topic] is the flat commands topic or a subpath (e.g. …/commands/update). */
    fun isDeviceCommandTopic(topic: String, topicPrefix: String, deviceKey: String): Boolean {
        if (topic == deviceCommandsTopic(topicPrefix, deviceKey)) return true
        val prefix = normalizedPrefix(topicPrefix)
        val base = "$prefix/devices/$deviceKey/commands/"
        return topic.startsWith(base)
    }

    /** True if [topic] is under fleet commands (…/devices/all/commands/…). */
    fun isFleetCommandTopic(topic: String, topicPrefix: String): Boolean {
        val prefix = normalizedPrefix(topicPrefix)
        val base = "$prefix/devices/all/commands/"
        return topic.startsWith(base)
    }

    /** Command path after …/commands/, e.g. `update` or `update/success` (device publish). */
    fun commandSuffix(topic: String, topicPrefix: String, deviceKey: String): String? {
        if (topic == deviceCommandsTopic(topicPrefix, deviceKey)) return null
        if (!isDeviceCommandTopic(topic, topicPrefix, deviceKey)) return null
        val prefix = normalizedPrefix(topicPrefix)
        val base = "$prefix/devices/$deviceKey/commands/"
        return topic.removePrefix(base).takeIf { it.isNotEmpty() }
    }

    fun fleetCommandSuffix(topic: String, topicPrefix: String): String? {
        if (!isFleetCommandTopic(topic, topicPrefix)) return null
        val prefix = normalizedPrefix(topicPrefix)
        val base = "$prefix/devices/all/commands/"
        return topic.removePrefix(base).takeIf { it.isNotEmpty() }
    }

    fun isCommandsUpdateTopic(topic: String, topicPrefix: String, deviceKey: String): Boolean =
        topic == deviceCommandsUpdateTopic(topicPrefix, deviceKey) ||
            topic == fleetCommandsUpdateTopic(topicPrefix)

    private fun deviceTopic(topicPrefix: String, deviceKey: String, suffix: String): String {
        val prefix = normalizedPrefix(topicPrefix)
        return "$prefix/devices/$deviceKey/$suffix"
    }

    private fun normalizedPrefix(topicPrefix: String): String =
        topicPrefix.trim().trimEnd('/')
}
