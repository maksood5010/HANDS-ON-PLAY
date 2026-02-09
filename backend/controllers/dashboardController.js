import { getPlaylistsByUserId } from "../models/playlistModel.js";
import { getDevicesByUserId } from "../models/deviceModel.js";
import pool from "../config/db.js";

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    // Playlists for this user
    const playlists = await getPlaylistsByUserId(userId);
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

    // Devices for this user
    const devices = await getDevicesByUserId(userId);
    const totalDevices = devices.length;
    const onlineDevices = devices.filter((d) => d.status === "online").length;
    const offlineDevices = totalDevices - onlineDevices;
    const activeDevices = devices.slice(0, 4).map((d) => ({
      id: d.id,
      name: d.name,
      playlist: d.playlist_name || "No playlist",
      status: d.status || "offline",
    }));

    // Schedules (derive basic counts from playlists table)
    const schedulesResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') AS active,
        COUNT(*) FILTER (WHERE status = 'scheduled' AND schedule_start > NOW()) AS upcoming,
        COUNT(*) FILTER (WHERE status = 'scheduled' AND schedule_end IS NOT NULL AND schedule_end < NOW()) AS completed
      FROM playlists
      WHERE user_id = $1`,
      [userId]
    );

    const schedulesRow = schedulesResult.rows[0] || {
      active: 0,
      upcoming: 0,
      completed: 0,
    };

    // For now, fabricate simple schedule items from scheduled playlists
    const scheduledPlaylistsResult = await pool.query(
      `SELECT id, name, schedule_start, schedule_end
       FROM playlists
       WHERE user_id = $1 AND status = 'scheduled'
       ORDER BY schedule_start DESC
       LIMIT 4`,
      [userId]
    );

    const scheduleItems = scheduledPlaylistsResult.rows.map((row) => ({
      id: row.id,
      playlist: row.name,
      device: "Device Group",
      startTime: row.schedule_start,
      endTime: row.schedule_end,
      status: "active",
    }));

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
        active: Number(schedulesRow.active) || 0,
        upcoming: Number(schedulesRow.upcoming) || 0,
        completed: Number(schedulesRow.completed) || 0,
        items: scheduleItems,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

