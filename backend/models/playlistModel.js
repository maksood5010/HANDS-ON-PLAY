import pool from "../config/db.js";
import { getActiveDailyScheduleForGroup } from "./playlistScheduleModel.js";

export const createPlaylist = async (companyId, name, description, userId) => {
  const result = await pool.query(
    `INSERT INTO playlists (company_id, name, description, user_id, status) 
     VALUES ($1, $2, $3, $4, 'inactive') 
     RETURNING id, company_id, name, description, user_id, status, schedule_start, schedule_end, created_at, updated_at`,
    [companyId, name, description || null, userId]
  );
  return result.rows[0];
};

export const getPlaylistsByCompanyId = async (companyId) => {
  const result = await pool.query(
    `SELECT p.*, 
            COUNT(pi.id) as item_count,
            dg.id as device_group_id,
            dg.name as device_group_name
     FROM playlists p
     LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
     LEFT JOIN device_groups dg ON p.device_group_id = dg.id
     WHERE p.company_id = $1
     GROUP BY p.id, dg.id, dg.name
     ORDER BY p.created_at DESC`,
    [companyId]
  );
  return result.rows;
};

export const getPlaylistById = async (playlistId, companyId) => {
  const result = await pool.query(
    `SELECT * FROM playlists 
     WHERE id = $1 AND company_id = $2`,
    [playlistId, companyId]
  );
  return result.rows[0] || null;
};

export const updatePlaylist = async (playlistId, companyId, name, description) => {
  const result = await pool.query(
    `UPDATE playlists 
     SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND company_id = $4
     RETURNING *`,
    [name, description || null, playlistId, companyId]
  );
  return result.rows[0] || null;
};

export const updatePlaylistStatus = async (playlistId, companyId, status, deviceGroupId = null) => {
  // If status is 'inactive', clear device_group_id
  const finalDeviceGroupId = status === 'inactive' ? null : deviceGroupId;
  
  const result = await pool.query(
    `UPDATE playlists 
     SET status = $1, device_group_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND company_id = $4
     RETURNING *`,
    [status, playlistId, finalDeviceGroupId, companyId]
  );
  return result.rows[0] || null;
};

export const schedulePlaylist = async (playlistId, companyId, startTime, endTime, deviceGroupId = null) => {
  const result = await pool.query(
    `UPDATE playlists 
     SET status = 'scheduled', schedule_start = $1, schedule_end = $2, device_group_id = $4, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND company_id = $5
     RETURNING *`,
    [startTime, endTime, playlistId, deviceGroupId, companyId]
  );
  return result.rows[0] || null;
};

export const clearPlaylistSchedule = async (playlistId, companyId) => {
  const result = await pool.query(
    `UPDATE playlists
     SET
       status = CASE WHEN status = 'scheduled' THEN 'inactive' ELSE status END,
       schedule_start = NULL,
       schedule_end = NULL,
       scheduled_start_push_sent_at = NULL,
       scheduled_end_push_sent_at = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [playlistId, companyId]
  );
  return result.rows[0] || null;
};

export const getActivePlaylistWithMeta = async (
  companyId,
  deviceGroupId = null
) => {
  if (!deviceGroupId) {
    // This system is device-group oriented; for safety return latest active/scheduled without resolving.
    const result = await pool.query(
      `SELECT *
       FROM playlists
       WHERE company_id = $1 AND (status = 'active' OR status = 'scheduled')
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [companyId]
    );
    const playlist = result.rows[0] || null;
    const clazz = playlist?.status === "active" ? "active" : "scheduled";
    return playlist
      ? { playlist, class: clazz, source: "company_fallback" }
      : { playlist: null, class: null, source: null };
  }

  // 1) Daily recurring schedules (Asia/Dubai)
  const activeDaily = await getActiveDailyScheduleForGroup({
    companyId,
    deviceGroupId,
    timezone: "Asia/Dubai",
  });

  if (activeDaily) {
    const playlistResult = await pool.query(
      `SELECT *
       FROM playlists
       WHERE id = $1 AND company_id = $2`,
      [activeDaily.playlist_id, companyId]
    );
    const playlist = playlistResult.rows[0] || null;
    return playlist
      ? { playlist, class: "scheduled", source: "daily" }
      : { playlist: null, class: null, source: null };
  }

  // 2) One-time scheduled playlists in window
  const scheduledResult = await pool.query(
    `SELECT *
     FROM playlists
     WHERE company_id = $1
       AND device_group_id = $2
       AND status = 'scheduled'
       AND schedule_start IS NOT NULL
       AND NOW() >= schedule_start
       AND (schedule_end IS NULL OR NOW() <= schedule_end)
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [companyId, deviceGroupId]
  );
  if (scheduledResult.rows[0]) {
    return { playlist: scheduledResult.rows[0], class: "scheduled", source: "one_time" };
  }

  // 3) Fallback to active playlist
  const activeResult = await pool.query(
    `SELECT *
     FROM playlists
     WHERE company_id = $1
       AND device_group_id = $2
       AND status = 'active'
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [companyId, deviceGroupId]
  );
  const playlist = activeResult.rows[0] || null;
  return playlist
    ? { playlist, class: "active", source: "active" }
    : { playlist: null, class: null, source: null };
};

export const getActivePlaylist = async (companyId, deviceGroupId = null) => {
  const { playlist } = await getActivePlaylistWithMeta(companyId, deviceGroupId);
  return playlist;
};

export const deletePlaylist = async (playlistId, companyId) => {
  const result = await pool.query(
    `DELETE FROM playlists 
     WHERE id = $1 AND company_id = $2
     RETURNING id`,
    [playlistId, companyId]
  );
  return result.rows[0] || null;
};

