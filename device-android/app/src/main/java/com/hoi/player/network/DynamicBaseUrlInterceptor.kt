package com.hoi.player.network

import com.hoi.player.utils.Constants
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Retrofit's baseUrl is fixed at creation time. This interceptor rewrites outgoing requests
 * to the latest saved Base API URL (Constants.apiUrl), so changing settings takes effect
 * immediately without rebuilding the DI graph.
 *
 * External media URLs (CDN, Spaces, etc.) are left unchanged.
 */
class DynamicBaseUrlInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val currentBase = Constants.apiUrl.toHttpUrlOrNull()
            ?: return chain.proceed(original)

        val oldUrl = original.url
        if (!shouldRewriteToApiBase(oldUrl.host, oldUrl.port, currentBase)) {
            return chain.proceed(original)
        }

        val newUrl = oldUrl.newBuilder()
            .scheme(currentBase.scheme)
            .host(currentBase.host)
            .port(currentBase.port)
            .build()

        val newRequest = original.newBuilder()
            .url(newUrl)
            .build()

        return chain.proceed(newRequest)
    }

    internal companion object {
        fun shouldRewriteToApiBase(
            requestHost: String,
            requestPort: Int,
            apiBase: okhttp3.HttpUrl
        ): Boolean {
            if (requestHost == apiBase.host && requestPort == apiBase.port) {
                return true
            }
            return requestHost == "127.0.0.1" ||
                requestHost == "localhost" ||
                requestHost == "[::1]"
        }
    }
}
