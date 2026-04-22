import { getPlaylistsByCompanyId } from "../models/playlistModel.js";
import { getDevicesByCompanyId } from "../models/deviceModel.js";
import pool from "../config/db.js";

// In shared-data mode, dashboard shows aggregated data across all users.
// user_id is no longer required; if provided, it is ignored.
export const getDashboardSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Playlists (scoped to company)
    const playlists = await getPlaylistsByCompanyId(companyId);
    const totalPlaylists = playlists.length;
    const activePlaylists = playlists.filter(
      (p) => p.status === "active" || p.status === "scheduled"
    ).length;
    const inactivePlaylists = totalPlaylists - activePlaylists;
    const recentPlaylists = playlists
      .slice() // shallow copy
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
      )
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        items: Number(p.item_count) || 0,
        status: p.status,
        lastUpdated: p.updated_at || p.created_at,
      }));

    // Devices (scoped to company)
    const devices = await getDevicesByCompanyId(companyId);
    const totalDevices = devices.length;
    const onlineDevices = devices.filter((d) => d.status === "online").length;
    const offlineDevices = totalDevices - onlineDevices;
    const activeDevices = devices.slice(0, 4).map((d) => ({
      id: d.id,
      name: d.name,
      playlist: d.playlist_name || "No playlist",
      status: d.status || "offline",
    }));

    // Schedules (daily recurring + one-time scheduled playlists)
    const schedulesResult = await pool.query(
      `SELECT
         (SELECT COUNT(*)
          FROM playlist_schedules ps
          WHERE ps.company_id = $1
            AND ps.enabled = TRUE
            AND ps.type = 'daily'
            AND ps.daily_start_time < ps.daily_end_time
            AND (NOW() AT TIME ZONE 'Asia/Dubai')::time >= ps.daily_start_time
            AND (NOW() AT TIME ZONE 'Asia/Dubai')::time <= ps.daily_end_time
         ) AS active_daily,
         (SELECT COUNT(*)
          FROM playlists p
          WHERE p.company_id = $1
            AND p.status = 'scheduled'
            AND p.schedule_start IS NOT NULL
            AND NOW() >= p.schedule_start
            AND (p.schedule_end IS NULL OR NOW() <= p.schedule_end)
         ) AS active_one_time,
         (SELECT COUNT(*)
          FROM playlists p
          WHERE p.company_id = $1
            AND p.status = 'scheduled'
            AND p.schedule_start IS NOT NULL
            AND p.schedule_start > NOW()
         ) AS upcoming_one_time,
         (SELECT COUNT(*)
          FROM playlists p
          WHERE p.company_id = $1
            AND p.status = 'scheduled'
            AND p.schedule_end IS NOT NULL
            AND p.schedule_end < NOW()
         ) AS completed_one_time`,
      [companyId]
    );

    const schedulesRow = schedulesResult.rows[0] || {
      active_daily: 0,
      active_one_time: 0,
      upcoming_one_time: 0,
      completed_one_time: 0,
    };

    const activeDailyItemsResult = await pool.query(
      `SELECT ps.id,
              p.name AS playlist_name,
              dg.name AS device_group_name,
              ps.daily_start_time,
              ps.daily_end_time
       FROM playlist_schedules ps
       JOIN playlists p ON p.id = ps.playlist_id
       JOIN device_groups dg ON dg.id = ps.device_group_id
       WHERE ps.company_id = $1
         AND ps.enabled = TRUE
         AND ps.type = 'daily'
         AND ps.daily_start_time < ps.daily_end_time
         AND (NOW() AT TIME ZONE 'Asia/Dubai')::time >= ps.daily_start_time
         AND (NOW() AT TIME ZONE 'Asia/Dubai')::time <= ps.daily_end_time
       ORDER BY ps.updated_at DESC, ps.created_at DESC
       LIMIT 4`,
      [companyId]
    );

    const upcomingOneTimeItemsResult = await pool.query(
      `SELECT id, name, schedule_start, schedule_end
       FROM playlists
       WHERE status = 'scheduled'
         AND company_id = $1
         AND schedule_start IS NOT NULL
         AND schedule_start > NOW()
       ORDER BY schedule_start ASC
       LIMIT 4`,
      [companyId]
    );

    const scheduleItems = [
      ...activeDailyItemsResult.rows.map((row) => ({
        id: `daily-${row.id}`,
        playlist: row.playlist_name,
        device: row.device_group_name,
        startTime: row.daily_start_time,
        endTime: row.daily_end_time,
        status: "active",
        type: "daily",
        timezone: "Asia/Dubai",
      })),
      ...upcomingOneTimeItemsResult.rows.map((row) => ({
        id: `one-time-${row.id}`,
        playlist: row.name,
        device: "Device Group",
        startTime: row.schedule_start,
        endTime: row.schedule_end,
        status: "upcoming",
        type: "one_time",
      })),
    ].slice(0, 4);

    return res.json({
      playlists: {
        total: totalPlaylists,
        active: activePlaylists,
        inactive: inactivePlaylists,
        recent: recentPlaylists,
      },
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
        active: activeDevices,
      },
      schedules: {
        active:
          (Number(schedulesRow.active_daily) || 0) +
          (Number(schedulesRow.active_one_time) || 0),
        upcoming: Number(schedulesRow.upcoming_one_time) || 0,
        completed: Number(schedulesRow.completed_one_time) || 0,
        items: scheduleItems,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

