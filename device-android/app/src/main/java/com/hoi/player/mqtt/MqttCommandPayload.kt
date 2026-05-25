package com.hoi.player.mqtt

/**
 * Parses inbound recovery command payloads on …/devices/{deviceKey}/commands.
 * Simple commands are a single line; [run-adb-command] uses line 2 as the shell command.
 */
fun parseMqttCommandPayload(raw: String): Pair<String, String?> {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return "" to null
    val newline = trimmed.indexOf('\n')
    if (newline < 0) return trimmed.lowercase() to null
    val command = trimmed.substring(0, newline).trim().lowercase()
    val args = trimmed.substring(newline + 1).trim()
    return command to args.takeIf { it.isNotEmpty() }
}
