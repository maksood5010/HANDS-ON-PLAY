package com.hoi.player.models

data class ValidateDeviceResponse(
    val success: Boolean,
    val valid: Boolean,
    val device: DeviceInfo?
)

data class DeviceInfo(
    val id: Int?,
    val name: String?,
    val group_id: Int?
)

