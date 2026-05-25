package com.hoi.player.utils

object Constants {
    const val PREF_BASE_API_URL: String = "pref_base_api_url"
    const val PREF_DEVICE_KEY: String = "device_key"
    const val PREF_COMPANY_ID: String = "company_id"
    const val PREF_GROUP_ID: String = "group_id"
    const val PREF_FCM_TOPIC: String = "fcm_topic"
    const val PREF_PLACEHOLDER_LOGO_URL: String = "placeholder_logo_url"

    const val PREF_MQTT_BROKER_URL: String = "pref_mqtt_broker_url"
    const val PREF_MQTT_TOPIC_PREFIX: String = "pref_mqtt_topic_prefix"

    const val ACTION_PLAYLIST_REFRESH: String = "com.hoi.player.action.PLAYLIST_REFRESH"
    const val ACTION_RESTART_PLAYBACK: String = "com.hoi.player.action.RESTART_PLAYBACK"
    const val ACTION_CONNECTIVITY_RESTORED: String = "com.hoi.player.action.CONNECTIVITY_RESTORED"

    const val EXTRA_APP_UPDATE_URL: String = "extra_app_update_url"

    private const val DEFAULT_BASE_API_URL: String = "http://192.168.1.204:5041/"
    private const val DEFAULT_MQTT_BROKER_URL: String = "mqtt://139.59.27.49:1883"
    private const val DEFAULT_MQTT_TOPIC_PREFIX: String = "hoi/v1"

    val apiUrl: String
        get() {
            val saved = PreferencesManager.get<String>(PREF_BASE_API_URL)
            return normalizeBaseUrl(saved) ?: DEFAULT_BASE_API_URL
        }

    val mqttBrokerUrl: String
        get() {
            val saved = PreferencesManager.get<String>(PREF_MQTT_BROKER_URL)
            return normalizeMqttBrokerUrl(saved) ?: DEFAULT_MQTT_BROKER_URL
        }

    val mqttTopicPrefix: String
        get() {
            val saved = PreferencesManager.get<String>(PREF_MQTT_TOPIC_PREFIX)?.trim()
            if (!saved.isNullOrEmpty()) {
                return saved.trimEnd('/')
            }
            return DEFAULT_MQTT_TOPIC_PREFIX
        }

    fun normalizeBaseUrl(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    fun normalizeMqttBrokerUrl(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (!trimmed.startsWith("mqtt://") && !trimmed.startsWith("mqtts://")) return null
        return trimmed.trimEnd('/')
    }
}
