package com.hoi.player.network

import com.hoi.player.models.DisplayPlaylistResponse
import com.hoi.player.models.SetTabletRequest
import com.hoi.player.models.ValidateDeviceResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @GET("server-status")
    suspend fun serverStatus(): Response<ApiResponse<Any>>

    @GET("display/validate-key")
    suspend fun validateDeviceKey(
        @Query("device_key") deviceKey: String
    ): Response<ValidateDeviceResponse>

    @GET("display")
    suspend fun getActivePlaylist(
        @Query("device_key") deviceKey: String
    ): Response<DisplayPlaylistResponse>

    @GET("display/heartbeat")
    suspend fun sendHeartbeat(
        @Query("device_key") deviceKey: String
    ): Response<ApiResponse<Any?>>
}