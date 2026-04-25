import pool from "../config/db.js";
import { getFirebaseMessaging } from "../utils/firebaseAdmin.js";

const ALL_DEVICES_GROUP_NAME = "All devices";

async function resolveTopicForGroup({ companyId, deviceGroupId }) {
  // Default: group-specific topic
  let topic = `c_${companyId}_g_${deviceGroupId}`;

  // If this is the special "All devices" group row, use the company-wide topic.
  try {
    const res = await pool.query(
      `SELECT name, user_id
       FROM device_groups
       WHERE id = $1 AND company_id = $2
       LIMIT 1`,
      [deviceGroupId, companyId]
    );
    const row = res.rows[0];
    const isAllDevices =
      !!row &&
      row.user_id === null &&
      typeof row.name === "string" &&
      row.name.trim() === ALL_DEVICES_GROUP_NAME;
    if (isAllDevices) topic = `c_${companyId}_all`;
  } catch {
    // Best-effort: if lookup fails, keep group-specific topic
  }

  return topic;
}

async function sendPlaylistRefresh({ topic, companyId, deviceGroupId, playlistId }) {
  const messageId = await getFirebaseMessaging().send({
    topic,
    android: {
      priority: "high",
      ttl: 60 * 1000, // 60s
    },
    data: {
      type: "playlist_refresh",
      company_id: String(companyId),
      group_id: String(deviceGroupId),
      playlist_id: String(playlistId),
      source: "scheduler",
    },
  });
  return messageId;
}

async function processOneTimeScheduleStarts({ batchSize }) {
  const res = await pool.query(
    `SELECT id, company_id, device_group_id
     FROM playlists
     WHERE status = 'scheduled'
       AND device_group_id IS NOT NULL
       AND schedule_start IS NOT NULL
       AND scheduled_start_push_sent_at IS NULL
       AND NOW() >= schedule_start
       AND (schedule_end IS NULL OR NOW() <= schedule_end)
     ORDER BY schedule_start ASC, updated_at DESC
     LIMIT $1`,
    [batchSize]
  );

  let sent = 0;
  for (const row of res.rows) {
    const topic = await resolveTopicForGroup({
      companyId: row.company_id,
      deviceGroupId: row.device_group_id,
    });

    try {
      const messageId = await sendPlaylistRefresh({
        topic,
        companyId: row.company_id,
        deviceGroupId: row.device_group_id,
        playlistId: row.id,
      });

      await pool.query(
        `UPDATE playlists
         SET scheduled_start_push_sent_at = NOW(), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND scheduled_start_push_sent_at IS NULL`,
        [row.id]
      );

      console.log(
        `Scheduled-start push sent playlist=${row.id} topic=${topic} messageId=${messageId}`
      );
      sent += 1;
    } catch (e) {
      console.warn(
        `Scheduled-start push failed playlist=${row.id} topic=${topic}`,
        e?.message ?? e
      );
    }
  }

  return sent;
}

async function processOneTimeScheduleEnds({ batchSize }) {
  const res = await pool.query(
    `SELECT id, company_id, device_group_id
     FROM playlists
     WHERE status = 'scheduled'
       AND device_group_id IS NOT NULL
       AND schedule_end IS NOT NULL
       AND scheduled_end_push_sent_at IS NULL
       AND NOW() >= schedule_end
     ORDER BY schedule_end ASC, updated_at DESC
     LIMIT $1`,
    [batchSize]
  );

  let sent = 0;
  for (const row of res.rows) {
    const topic = await resolveTopicForGroup({
      companyId: row.company_id,
      deviceGroupId: row.device_group_id,
    });

    try {
      const messageId = await sendPlaylistRefresh({
        topic,
        companyId: row.company_id,
        deviceGroupId: row.device_group_id,
        playlistId: row.id,
      });

      await pool.query(
        `UPDATE playlists
         SET scheduled_end_push_sent_at = NOW(), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND scheduled_end_push_sent_at IS NULL`,
        [row.id]
      );

      console.log(
        `Scheduled-end push sent playlist=${row.id} topic=${topic} messageId=${messageId}`
      );
      sent += 1;
    } catch (e) {
      console.warn(
        `Scheduled-end push failed playlist=${row.id} topic=${topic}`,
        e?.message ?? e
      );
    }
  }

  return sent;
}

async function processDailyScheduleStarts({ batchSize }) {
  // Use per-row timezone to compute local date/time; send exactly-once per local date.
  const res = await pool.query(
    `SELECT ps.id AS schedule_id,
            ps.company_id,
            ps.device_group_id,
            ps.playlist_id,
            ps.timezone,
            (NOW() AT TIME ZONE ps.timezone)::date AS local_date
     FROM playlist_schedules ps
     WHERE ps.enabled = TRUE
       AND ps.type = 'daily'
       AND ps.daily_start_time < ps.daily_end_time
       AND (NOW() AT TIME ZONE ps.timezone)::time >= ps.daily_start_time
       AND (NOW() AT TIME ZONE ps.timezone)::time <= ps.daily_end_time
       AND (
         ps.last_start_push_sent_for_date IS NULL
         OR ps.last_start_push_sent_for_date < (NOW() AT TIME ZONE ps.timezone)::date
       )
     ORDER BY ps.updated_at DESC, ps.created_at DESC
     LIMIT $1`,
    [batchSize]
  );

  let sent = 0;
  for (const row of res.rows) {
    const topic = await resolveTopicForGroup({
      companyId: row.company_id,
      deviceGroupId: row.device_group_id,
    });

    try {
      const messageId = await sendPlaylistRefresh({
        topic,
        companyId: row.company_id,
        deviceGroupId: row.device_group_id,
        playlistId: row.playlist_id,
      });

      await pool.query(
        `UPDATE playlist_schedules
         SET last_start_push_sent_for_date = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND (
             last_start_push_sent_for_date IS NULL
             OR last_start_push_sent_for_date < $1
           )`,
        [row.local_date, row.schedule_id]
      );

      console.log(
        `Daily-start push sent schedule=${row.schedule_id} playlist=${row.playlist_id} topic=${topic} messageId=${messageId}`
      );
      sent += 1;
    } catch (e) {
      console.warn(
        `Daily-start push failed schedule=${row.schedule_id} topic=${topic}`,
        e?.message ?? e
      );
    }
  }

  return sent;
}

async function processDailyScheduleEnds({ batchSize }) {
  const res = await pool.query(
    `SELECT ps.id AS schedule_id,
            ps.company_id,
            ps.device_group_id,
            ps.playlist_id,
            ps.timezone,
            (NOW() AT TIME ZONE ps.timezone)::date AS local_date
     FROM playlist_schedules ps
     WHERE ps.enabled = TRUE
       AND ps.type = 'daily'
       AND ps.daily_start_time < ps.daily_end_time
       AND (NOW() AT TIME ZONE ps.timezone)::time >= ps.daily_end_time
       AND (
         ps.last_end_push_sent_for_date IS NULL
         OR ps.last_end_push_sent_for_date < (NOW() AT TIME ZONE ps.timezone)::date
       )
     ORDER BY ps.updated_at DESC, ps.created_at DESC
     LIMIT $1`,
    [batchSize]
  );

  let sent = 0;
  for (const row of res.rows) {
    const topic = await resolveTopicForGroup({
      companyId: row.company_id,
      deviceGroupId: row.device_group_id,
    });

    try {
      const messageId = await sendPlaylistRefresh({
        topic,
        companyId: row.company_id,
        deviceGroupId: row.device_group_id,
        playlistId: row.playlist_id,
      });

      await pool.query(
        `UPDATE playlist_schedules
         SET last_end_push_sent_for_date = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND (
             last_end_push_sent_for_date IS NULL
             OR last_end_push_sent_for_date < $1
           )`,
        [row.local_date, row.schedule_id]
      );

      console.log(
        `Daily-end push sent schedule=${row.schedule_id} playlist=${row.playlist_id} topic=${topic} messageId=${messageId}`
      );
      sent += 1;
    } catch (e) {
      console.warn(
        `Daily-end push failed schedule=${row.schedule_id} topic=${topic}`,
        e?.message ?? e
      );
    }
  }

  return sent;
}

export function startScheduledPlaylistPushJob({
  intervalMs = 5000,
  batchSize = 25,
} = {}) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processOneTimeScheduleStarts({ batchSize });
      await processDailyScheduleStarts({ batchSize });
      await processOneTimeScheduleEnds({ batchSize });
      await processDailyScheduleEnds({ batchSize });
    } catch (e) {
      console.warn("scheduledPlaylistPush tick failed", e?.message ?? e);
    } finally {
      running = false;
    }
  };

  // Run once at startup, then poll.
  tick();
  const handle = setInterval(tick, intervalMs);
  console.log(
    `Scheduled playlist push job started intervalMs=${intervalMs} batchSize=${batchSize}`
  );

  return () => clearInterval(handle);
}

