package com.hoi.player.update

object AppUpdateUrlValidator {
    fun validate(raw: String): String? {
        val url = raw.trim()
        if (url.isEmpty()) return null
        if (!url.startsWith("http://") && !url.startsWith("https://")) return null
        return url
    }
}
