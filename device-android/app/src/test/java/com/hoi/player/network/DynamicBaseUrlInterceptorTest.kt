package com.hoi.player.network

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DynamicBaseUrlInterceptorTest {

    private val apiBase = "http://192.168.1.204:5041".toHttpUrl()

    @Test
    fun shouldRewrite_localhostPlaceholder() {
        assertTrue(
            DynamicBaseUrlInterceptor.shouldRewriteToApiBase("127.0.0.1", 80, apiBase)
        )
    }

    @Test
    fun shouldRewrite_matchingApiHost() {
        assertTrue(
            DynamicBaseUrlInterceptor.shouldRewriteToApiBase(
                apiBase.host,
                apiBase.port,
                apiBase
            )
        )
    }

    @Test
    fun shouldNotRewrite_cdnHost() {
        assertFalse(
            DynamicBaseUrlInterceptor.shouldRewriteToApiBase(
                "hoi-media.fra1.cdn.digitaloceanspaces.com",
                443,
                apiBase
            )
        )
    }
}
