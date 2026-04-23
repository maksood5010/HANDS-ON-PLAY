package com.hoi.player.network

import com.hoi.player.utils.Constants
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Retrofit's baseUrl is fixed at creation time. This interceptor rewrites outgoing requests
 * to the latest saved Base API URL (Constants.apiUrl), so changing settings takes effect
 * immediately without rebuilding the DI graph.
 */
class DynamicBaseUrlInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val currentBase = Constants.apiUrl.toHttpUrlOrNull()
        if (currentBase == null) {
            return chain.proceed(original)
        }

        val oldUrl = original.url
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
}

