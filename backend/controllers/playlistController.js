import {
  createPlaylist,
  getPlaylistsByCompanyId,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  updatePlaylistStatus,
  schedulePlaylist
} from "../models/playlistModel.js";
import { canUserAccessGroup } from "../models/deviceGroupModel.js";
import {
  getPlaylistWithItems,
  addItemToPlaylist,
  getPlaylistItems,
  updateItemDuration,
  deleteItem,
  getNextDisplayOrder
} from "../models/playlistItemModel.js";
import { saveFile, getFileById, deleteFile } from "../models/fileModel.js";
import {
  createDailySchedule,
  listSchedules,
  updateSchedule,
  deleteSchedule,
  getScheduleById,
} from "../models/playlistScheduleModel.js";
import pool from "../config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create playlist
export const createPlaylistHandler = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    const playlist = await createPlaylist(companyId, name.trim(), description, userId);
    res.status(201).json({ success: true, playlist });
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all playlists for user
export const getPlaylistsHandler = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const playlists = await getPlaylistsByCompanyId(companyId);
    res.json({ success: true, playlists });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get single playlist with items
export const getPlaylistHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const playlist = await getPlaylistWithItems(parseInt(id), companyId);
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error fetching playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update playlist
export const updatePlaylistHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const companyId = req.user.company_id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    const playlist = await updatePlaylist(parseInt(id), companyId, name.trim(), description);
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error updating playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete playlist
export const deletePlaylistHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const playlist = await deletePlaylist(parseInt(id), companyId);
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, message: "Playlist deleted successfully" });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Helper to save an uploaded file and create a playlist item
const processUploadedFile = async (companyId, playlistId, file, userId, durationOverride = null) => {
  // Determine file type
  const fileType = file.mimetype.startsWith("image/") ? "image" : "video";

  // Get relative path for storage
  const relativePath = path
    .relative(path.join(__dirname, "../uploads"), file.path)
    .replace(/\\/g, "/");

  // Save file metadata
  const fileRecord = await saveFile(
    companyId,
    file.originalname,
    file.filename,
    relativePath,
    fileType,
    file.size,
    file.mimetype,
    userId
  );

  // Get next display order
  const displayOrder = await getNextDisplayOrder(playlistId, companyId);

  // Add to playlist (default duration 5 seconds for images, null for videos)
  const itemDuration =
    fileType === "image"
      ? parseInt(durationOverride ?? 0, 10) || 5
      : null;

  const playlistItem = await addItemToPlaylist(
    companyId,
    playlistId,
    fileRecord.id,
    itemDuration,
    displayOrder
  );

  return { fileRecord, playlistItem };
};

// Upload file and add to playlist (single-file endpoint, uses shared helper)
export const uploadFileToPlaylistHandler = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { duration } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify playlist exists
    const playlist = await getPlaylistById(parseInt(playlistId), companyId);
    if (!playlist) {
      // Delete uploaded file if playlist doesn't exist
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "Playlist not found" });
    }

    const { fileRecord, playlistItem } = await processUploadedFile(
      companyId,
      parseInt(playlistId),
      file,
      userId,
      duration
    );

    res.status(201).json({
      success: true,
      file: fileRecord,
      playlistItem
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    // Delete file if error occurred
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error deleting file:", unlinkError);
      }
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Upload multiple files and add them to playlist
export const uploadFilesToPlaylistHandler = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.user?.id || null;
    const companyId = req.user?.company_id || null;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    if (!companyId || !userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify playlist exists
    const playlist = await getPlaylistById(parseInt(playlistId), companyId);
    if (!playlist) {
      // Delete uploaded files if playlist doesn't exist
      for (const file of files) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore
        }
      }
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Parse durations (optional) - expect durations[] aligned with files order
    let durations = [];
    const rawDurations = req.body["durations[]"] ?? req.body.durations;
    if (Array.isArray(rawDurations)) {
      durations = rawDurations;
    } else if (typeof rawDurations === "string") {
      durations = [rawDurations];
    }

    const createdFiles = [];
    const createdItems = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const duration = durations[i] ?? null;
      const { fileRecord, playlistItem } = await processUploadedFile(
        companyId,
        parseInt(playlistId),
        file,
        userId,
        duration
      );
      createdFiles.push(fileRecord);
      createdItems.push(playlistItem);
    }

    res.status(201).json({
      success: true,
      files: createdFiles,
      playlistItems: createdItems
    });
  } catch (error) {
    console.error("Error uploading multiple files:", error);
    // Best-effort cleanup of any uploaded files on error
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get playlist items
export const getPlaylistItemsHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const items = await getPlaylistItems(parseInt(id), companyId);
    res.json({ success: true, items });
  } catch (error) {
    console.error("Error fetching playlist items:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update item duration
export const updateItemDurationHandler = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { duration } = req.body;
    const companyId = req.user.company_id;

    if (!duration || duration < 1) {
      return res.status(400).json({ error: "Duration must be at least 1 second" });
    }

    const item = await updateItemDuration(parseInt(itemId), companyId, parseInt(duration));
    
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error("Error updating item duration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update item order (swap with adjacent item)
export const updateItemOrderHandler = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { direction } = req.body; // 'up' or 'down'
    const companyId = req.user.company_id;

    if (!direction || (direction !== 'up' && direction !== 'down')) {
      return res.status(400).json({ error: "Direction must be 'up' or 'down'" });
    }

    const { swapItemOrder } = await import("../models/playlistItemModel.js");
    const item = await swapItemOrder(parseInt(itemId), companyId, direction);
    
    if (!item) {
      return res.status(404).json({ error: "Item not found or cannot be moved" });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error("Error updating item order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete item from playlist
export const deleteItemHandler = async (req, res) => {
  try {
    const { itemId } = req.params;
    const companyId = req.user.company_id;

    const item = await deleteItem(parseInt(itemId), companyId);
    
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Set playlist as active
export const setPlaylistActiveHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_group_id } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!device_group_id) {
      return res.status(400).json({ error: "Device group is required" });
    }

    // Validate that the group exists and user has access
    const canAccess = await canUserAccessGroup(parseInt(device_group_id), companyId);
    if (!canAccess) {
      return res.status(404).json({ error: "Device group not found" });
    }

    // Set all other playlists for the same device group to inactive and clear their device_group_id
    // This ensures replacement logic: old playlist is fully deactivated when new one is activated
    await pool.query(
      `UPDATE playlists 
       SET status = 'inactive', device_group_id = NULL
       WHERE company_id = $1 
       AND device_group_id = $2 
       AND id != $3`,
      [companyId, parseInt(device_group_id), parseInt(id)]
    );

    const playlist = await updatePlaylistStatus(parseInt(id), companyId, 'active', parseInt(device_group_id));
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error setting playlist active:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Set playlist as inactive
export const setPlaylistInactiveHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const playlist = await updatePlaylistStatus(parseInt(id), companyId, 'inactive');
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error setting playlist inactive:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Schedule playlist
export const schedulePlaylistHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, device_group_id } = req.body;
    const companyId = req.user.company_id;

    if (!start_time) {
      return res.status(400).json({ error: "Start time is required" });
    }

    if (!device_group_id) {
      return res.status(400).json({ error: "Device group is required" });
    }

    // Validate that the group exists and user has access
    const canAccess = await canUserAccessGroup(parseInt(device_group_id), companyId);
    if (!canAccess) {
      return res.status(404).json({ error: "Device group not found" });
    }

    const playlist = await schedulePlaylist(parseInt(id), companyId, start_time, end_time || null, parseInt(device_group_id));
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error scheduling playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a daily repeating schedule for a playlist
export const createDailyScheduleHandler = async (req, res) => {
  try {
    const { id } = req.params; // playlist id
    const { device_group_id, daily_start_time, daily_end_time, enabled } =
      req.body;
    const companyId = req.user.company_id;

    if (!device_group_id) {
      return res.status(400).json({ error: "Device group is required" });
    }
    if (!daily_start_time || !daily_end_time) {
      return res
        .status(400)
        .json({ error: "Daily start and end time are required" });
    }
    if (daily_start_time >= daily_end_time) {
      return res.status(400).json({
        error: "Daily start time must be before daily end time",
      });
    }

    const canAccess = await canUserAccessGroup(
      parseInt(device_group_id),
      companyId
    );
    if (!canAccess) {
      return res.status(404).json({ error: "Device group not found" });
    }

    // Ensure playlist exists in this company
    const playlist = await getPlaylistById(parseInt(id), companyId);
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const schedule = await createDailySchedule({
      companyId,
      deviceGroupId: parseInt(device_group_id),
      playlistId: parseInt(id),
      dailyStartTime: daily_start_time,
      dailyEndTime: daily_end_time,
      timezone: "Asia/Dubai",
      enabled: enabled === undefined ? true : Boolean(enabled),
    });

    return res.status(201).json({ success: true, schedule });
  } catch (error) {
    console.error("Error creating daily schedule:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// List schedules (optionally filtered)
export const listSchedulesHandler = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const deviceGroupId = req.query.device_group_id
      ? parseInt(req.query.device_group_id)
      : null;
    const playlistId = req.query.playlist_id
      ? parseInt(req.query.playlist_id)
      : null;

    if (deviceGroupId) {
      const canAccess = await canUserAccessGroup(deviceGroupId, companyId);
      if (!canAccess) {
        return res.status(404).json({ error: "Device group not found" });
      }
    }

    const schedules = await listSchedules({
      companyId,
      deviceGroupId,
      playlistId,
    });
    return res.json({ success: true, schedules });
  } catch (error) {
    console.error("Error listing schedules:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Update schedule
export const updateScheduleHandler = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { scheduleId } = req.params;
    const { daily_start_time, daily_end_time, enabled } = req.body;

    const existing = await getScheduleById({
      companyId,
      scheduleId: parseInt(scheduleId),
    });
    if (!existing) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    const start = daily_start_time ?? existing.daily_start_time;
    const end = daily_end_time ?? existing.daily_end_time;
    if (start && end && start >= end) {
      return res.status(400).json({
        error: "Daily start time must be before daily end time",
      });
    }

    const schedule = await updateSchedule({
      companyId,
      scheduleId: parseInt(scheduleId),
      dailyStartTime: daily_start_time,
      dailyEndTime: daily_end_time,
      enabled,
    });

    return res.json({ success: true, schedule });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Delete schedule
export const deleteScheduleHandler = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { scheduleId } = req.params;

    const deleted = await deleteSchedule({
      companyId,
      scheduleId: parseInt(scheduleId),
    });
    if (!deleted) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

