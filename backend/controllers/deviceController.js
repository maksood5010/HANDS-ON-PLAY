import {
  createDevice,
  getDevicesByCompanyId,
  getDeviceById,
  deleteDevice,
  updateDevicePlaylist
} from "../models/deviceModel.js";
import { requestDeviceStatus } from "../mqtt/deviceStatusRequest.js";
import { isMqttConnected } from "../utils/mqttClient.js";
import { getPlaylistById } from "../models/playlistModel.js";
import { canUserAccessGroup } from "../models/deviceGroupModel.js";
import pool from "../config/db.js";

// Create device
export const createDeviceHandler = async (req, res) => {
  try {
    const { name, groupId } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Device name is required" });
    }

    if (!groupId) {
      return res.status(400).json({ error: "Group is required" });
    }

    // Validate that the group exists and user can access it (global or user-owned)
    const canAccess = await canUserAccessGroup(parseInt(groupId), companyId);
    if (!canAccess) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Enforce company device limit: device_limit=0 means unlimited
    const limitRes = await pool.query(`SELECT device_limit FROM companies WHERE id = $1`, [companyId]);
    const deviceLimit = limitRes.rows[0]?.device_limit ?? 0;
    if (deviceLimit > 0) {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM devices WHERE company_id = $1`,
        [companyId]
      );
      const currentCount = countRes.rows[0]?.count ?? 0;
      if (currentCount >= deviceLimit) {
        return res.status(409).json({ error: "Oops…. Your device limit is reached contact us on +971508739464" });
      }
    }

    const device = await createDevice(companyId, name.trim(), userId, parseInt(groupId));
    res.status(201).json({ success: true, device });
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all devices for user
export const getDevicesHandler = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const devices = await getDevicesByCompanyId(companyId);
    res.json({ success: true, devices });
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function isDeviceRecentlySeen(device) {
  if (!device?.last_seen_at) return false;
  const last = new Date(device.last_seen_at).getTime();
  return Number.isFinite(last) && Date.now() - last < ONLINE_WINDOW_MS;
}

// Live playback/health via MQTT request/response (not stored in DB)
export const getDeviceStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const device = await getDeviceById(parseInt(id), companyId);
    if (!device) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    if (!isDeviceRecentlySeen(device)) {
      return res.status(503).json({
        success: false,
        reason: "offline",
        error: "Device is offline",
      });
    }

    if (!isMqttConnected()) {
      return res.status(503).json({
        success: false,
        reason: "mqtt_unavailable",
        error: "MQTT is not connected",
      });
    }

    const status = await requestDeviceStatus(device.device_key);
    return res.json({ success: true, status });
  } catch (error) {
    const message = error?.message ?? "Failed to fetch device status";
    if (message.includes("timed out")) {
      return res.status(504).json({
        success: false,
        reason: "timeout",
        error: message,
      });
    }
    console.error("Error fetching device status:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Get single device
export const getDeviceHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const device = await getDeviceById(parseInt(id), companyId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ success: true, device });
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete device
export const deleteDeviceHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const device = await deleteDevice(parseInt(id), companyId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ success: true, message: "Device deleted successfully" });
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Assign playlist to device
export const assignPlaylistHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { playlistId } = req.body;
    const companyId = req.user.company_id;

    // Verify playlist exists and belongs to user (if playlistId is provided)
    if (playlistId) {
      const playlist = await getPlaylistById(parseInt(playlistId), companyId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }
    }

    const device = await updateDevicePlaylist(
      parseInt(id),
      companyId,
      playlistId ? parseInt(playlistId) : null
    );
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ success: true, device });
  } catch (error) {
    console.error("Error assigning playlist to device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
