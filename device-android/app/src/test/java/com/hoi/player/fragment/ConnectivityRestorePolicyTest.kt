package com.hoi.player.fragment

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectivityRestorePolicyTest {

    @Test
    fun shouldFetch_whenPlaylistEmpty() {
        assertTrue(shouldFetchOnConnectivityRestore(playlistItemCount = 0))
    }

    @Test
    fun shouldNotFetch_whenPlaylistHasItems() {
        assertFalse(shouldFetchOnConnectivityRestore(playlistItemCount = 1))
        assertFalse(shouldFetchOnConnectivityRestore(playlistItemCount = 5))
    }
}
