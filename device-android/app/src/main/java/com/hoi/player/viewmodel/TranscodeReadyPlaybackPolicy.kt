package com.hoi.player.viewmodel

/** Whether transcode finishing should advance the playlist instead of replaying the current item. */
fun shouldAdvanceOnTranscodeReady(
    fileId: Int,
    bypassLocalTranscodeFileIds: Set<Int>,
    playedDuringCurrentVisitFileIds: Set<Int>
): Boolean =
    fileId in bypassLocalTranscodeFileIds || fileId in playedDuringCurrentVisitFileIds
