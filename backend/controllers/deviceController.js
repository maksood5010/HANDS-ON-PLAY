import {
  createDevice,
  getDevicesByCompanyId,
  getDeviceById,
  deleteDevice,
  updateDevicePlaylist
} from "../models/deviceModel.js";
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
        return res.status(409).json({ error: "Device limit reached for this company" });
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
