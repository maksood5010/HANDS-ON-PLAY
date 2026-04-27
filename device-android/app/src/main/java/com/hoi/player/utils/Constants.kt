package com.hoi.player.utils

object Constants {
    const val PREF_BASE_API_URL: String = "pref_base_api_url"
    const val PREF_DEVICE_KEY: String = "device_key"
    const val PREF_COMPANY_ID: String = "company_id"
    const val PREF_GROUP_ID: String = "group_id"
    const val PREF_FCM_TOPIC: String = "fcm_topic"
    const val PREF_PLACEHOLDER_LOGO_URL: String = "placeholder_logo_url"

    const val ACTION_PLAYLIST_REFRESH: String = "com.hoi.player.action.PLAYLIST_REFRESH"

    private const val DEFAULT_BASE_API_URL: String = "http://192.168.1.230:5041/"

    val apiUrl: String
        get() {
            val saved = PreferencesManager.get<String>(PREF_BASE_API_URL)
            return normalizeBaseUrl(saved) ?: DEFAULT_BASE_API_URL
        }

    fun normalizeBaseUrl(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}