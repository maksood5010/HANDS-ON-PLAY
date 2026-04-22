import pool from "../config/db.js";

export const createDailySchedule = async ({
  companyId,
  deviceGroupId,
  playlistId,
  dailyStartTime,
  dailyEndTime,
  timezone = "Asia/Dubai",
  enabled = true,
}) => {
  const result = await pool.query(
    `INSERT INTO playlist_schedules
      (company_id, device_group_id, playlist_id, type, daily_start_time, daily_end_time, timezone, enabled)
     VALUES ($1, $2, $3, 'daily', $4, $5, $6, $7)
     RETURNING *`,
    [
      companyId,
      deviceGroupId,
      playlistId,
      dailyStartTime,
      dailyEndTime,
      timezone,
      enabled,
    ]
  );
  return result.rows[0] || null;
};

export const listSchedules = async ({ companyId, deviceGroupId, playlistId }) => {
  const where = ["ps.company_id = $1"];
  const params = [companyId];

  if (deviceGroupId) {
    params.push(deviceGroupId);
    where.push(`ps.device_group_id = $${params.length}`);
  }

  if (playlistId) {
    params.push(playlistId);
    where.push(`ps.playlist_id = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT ps.*,
            p.name AS playlist_name,
            dg.name AS device_group_name
     FROM playlist_schedules ps
     JOIN playlists p ON p.id = ps.playlist_id
     JOIN device_groups dg ON dg.id = ps.device_group_id
     WHERE ${where.join(" AND ")}
     ORDER BY ps.updated_at DESC, ps.created_at DESC`,
    params
  );
  return result.rows;
};

export const getScheduleById = async ({ companyId, scheduleId }) => {
  const result = await pool.query(
    `SELECT * FROM playlist_schedules
     WHERE id = $1 AND company_id = $2`,
    [scheduleId, companyId]
  );
  return result.rows[0] || null;
};

export const updateSchedule = async ({
  companyId,
  scheduleId,
  dailyStartTime,
  dailyEndTime,
  enabled,
}) => {
  const result = await pool.query(
    `UPDATE playlist_schedules
     SET daily_start_time = COALESCE($1, daily_start_time),
         daily_end_time = COALESCE($2, daily_end_time),
         enabled = COALESCE($3, enabled),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND company_id = $5
     RETURNING *`,
    [dailyStartTime ?? null, dailyEndTime ?? null, enabled ?? null, scheduleId, companyId]
  );
  return result.rows[0] || null;
};

export const deleteSchedule = async ({ companyId, scheduleId }) => {
  const result = await pool.query(
    `DELETE FROM playlist_schedules
     WHERE id = $1 AND company_id = $2
     RETURNING id`,
    [scheduleId, companyId]
  );
  return result.rows[0] || null;
};

export const getActiveDailyScheduleForGroup = async ({
  companyId,
  deviceGroupId,
  timezone = "Asia/Dubai",
}) => {
  const result = await pool.query(
    `SELECT ps.*
     FROM playlist_schedules ps
     WHERE ps.company_id = $1
       AND ps.device_group_id = $2
       AND ps.enabled = TRUE
       AND ps.type = 'daily'
       AND ps.daily_start_time < ps.daily_end_time
       AND (NOW() AT TIME ZONE $3)::time >= ps.daily_start_time
       AND (NOW() AT TIME ZONE $3)::time <= ps.daily_end_time
     ORDER BY ps.updated_at DESC, ps.created_at DESC
     LIMIT 1`,
    [companyId, deviceGroupId, timezone]
  );
  return result.rows[0] || null;
};

