package com.hoi.player.fragment

/**
 * Whether a connectivity-restore event should trigger a playlist fetch.
 * Fetch only when the player is idle (no playlist items loaded).
 */
fun shouldFetchOnConnectivityRestore(playlistItemCount: Int): Boolean {
    return playlistItemCount == 0
}
