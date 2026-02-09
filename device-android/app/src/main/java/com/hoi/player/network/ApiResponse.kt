package com.hoi.player.network

data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T,
) {
    fun isSuccessful(): Boolean {
        return success
    }

    fun errorBody(): String? {
        return message
    }

}