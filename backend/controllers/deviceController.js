import {
  createDevice,
  getDevicesByUserId,
  getDeviceById,
  deleteDevice,
  updateDevicePlaylist
} from "../models/deviceModel.js";
import { getPlaylistById } from "../models/playlistModel.js";
import { canUserAccessGroup } from "../models/deviceGroupModel.js";

// Create device
export const createDeviceHandler = async (req, res) => {
  try {
    const { name, groupId } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Device name is required" });
    }

    if (!groupId) {
      return res.status(400).json({ error: "Group is required" });
    }

    // Validate that the group exists and user can access it (global or user-owned)
    const canAccess = await canUserAccessGroup(parseInt(groupId), userId);
    if (!canAccess) {
      return res.status(404).json({ error: "Group not found" });
    }

    const device = await createDevice(name.trim(), userId, parseInt(groupId));
    res.status(201).json({ success: true, device });
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all devices for user
export const getDevicesHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const devices = await getDevicesByUserId(userId);
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
    const userId = req.user.id;

    const device = await getDeviceById(parseInt(id), userId);
    
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
    const userId = req.user.id;

    const device = await deleteDevice(parseInt(id), userId);
    
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
    const userId = req.user.id;

    // Verify playlist exists and belongs to user (if playlistId is provided)
    if (playlistId) {
      const playlist = await getPlaylistById(parseInt(playlistId), userId);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }
    }

    const device = await updateDevicePlaylist(
      parseInt(id),
      playlistId ? parseInt(playlistId) : null,
      userId
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
