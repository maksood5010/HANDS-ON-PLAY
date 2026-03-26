import {
  createPlaylist,
  getPlaylistsByUserId,
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

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    const playlist = await createPlaylist(name.trim(), description, userId);
    res.status(201).json({ success: true, playlist });
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all playlists for user
export const getPlaylistsHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const playlists = await getPlaylistsByUserId(userId);
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
    const userId = req.user.id;

    const playlist = await getPlaylistWithItems(parseInt(id), userId);
    
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
    const userId = req.user.id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    const playlist = await updatePlaylist(parseInt(id), name.trim(), description, userId);
    
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
    const userId = req.user.id;

    const playlist = await deletePlaylist(parseInt(id), userId);
    
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
const processUploadedFile = async (playlistId, file, userId, durationOverride = null) => {
  // Determine file type
  const fileType = file.mimetype.startsWith("image/") ? "image" : "video";

  // Get relative path for storage
  const relativePath = path
    .relative(path.join(__dirname, "../uploads"), file.path)
    .replace(/\\/g, "/");

  // Save file metadata
  const fileRecord = await saveFile(
    file.originalname,
    file.filename,
    relativePath,
    fileType,
    file.size,
    file.mimetype,
    userId
  );

  // Get next display order
  const displayOrder = await getNextDisplayOrder(playlistId);

  // Add to playlist (default duration 5 seconds for images, null for videos)
  const itemDuration =
    fileType === "image"
      ? parseInt(durationOverride ?? 0, 10) || 5
      : null;

  const playlistItem = await addItemToPlaylist(
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
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify playlist exists
    const playlist = await getPlaylistById(parseInt(playlistId), userId);
    if (!playlist) {
      // Delete uploaded file if playlist doesn't exist
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "Playlist not found" });
    }

    const { fileRecord, playlistItem } = await processUploadedFile(
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
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Verify playlist exists
    const playlist = await getPlaylistById(parseInt(playlistId), userId);
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
    const userId = req.user.id;

    const items = await getPlaylistItems(parseInt(id), userId);
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
    const userId = req.user.id;

    if (!duration || duration < 1) {
      return res.status(400).json({ error: "Duration must be at least 1 second" });
    }

    const item = await updateItemDuration(parseInt(itemId), parseInt(duration), userId);
    
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
    const userId = req.user.id;

    if (!direction || (direction !== 'up' && direction !== 'down')) {
      return res.status(400).json({ error: "Direction must be 'up' or 'down'" });
    }

    const { swapItemOrder } = await import("../models/playlistItemModel.js");
    const item = await swapItemOrder(parseInt(itemId), direction, userId);
    
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
    const userId = req.user.id;

    const item = await deleteItem(parseInt(itemId), userId);
    
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

    if (!device_group_id) {
      return res.status(400).json({ error: "Device group is required" });
    }

    // Validate that the group exists and user has access
    const canAccess = await canUserAccessGroup(parseInt(device_group_id), userId);
    if (!canAccess) {
      return res.status(404).json({ error: "Device group not found" });
    }

    // Set all other playlists for the same device group to inactive and clear their device_group_id
    // This ensures replacement logic: old playlist is fully deactivated when new one is activated
    await pool.query(
      `UPDATE playlists 
       SET status = 'inactive', device_group_id = NULL
       WHERE user_id = $1 
       AND device_group_id = $2 
       AND id != $3`,
      [userId, parseInt(device_group_id), parseInt(id)]
    );

    const playlist = await updatePlaylistStatus(parseInt(id), 'active', userId, parseInt(device_group_id));
    
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
    const userId = req.user.id;

    const playlist = await updatePlaylistStatus(parseInt(id), 'inactive', userId);
    
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
    const userId = req.user.id;

    if (!start_time) {
      return res.status(400).json({ error: "Start time is required" });
    }

    if (!device_group_id) {
      return res.status(400).json({ error: "Device group is required" });
    }

    // Validate that the group exists and user has access
    const canAccess = await canUserAccessGroup(parseInt(device_group_id), userId);
    if (!canAccess) {
      return res.status(404).json({ error: "Device group not found" });
    }

    const playlist = await schedulePlaylist(parseInt(id), start_time, end_time || null, userId, parseInt(device_group_id));
    
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error scheduling playlist:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

