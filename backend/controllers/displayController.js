import { getActivePlaylist } from "../models/playlistModel.js";
import { getPlaylistWithItems } from "../models/playlistItemModel.js";
import { getDeviceByKey, updateDeviceLastSeen } from "../models/deviceModel.js";

// Helper function to return placeholder playlist
const getPlaceholderPlaylist = (req) => {
  const placeholderPath = "placeholder/handson.png";
  return {
    success: true,
    playlist: {
      id: 0,
      name: "Placeholder",
      description: "No active playlist assigned",
      status: "active",
      items: [
        {
          id: 0,
          file_id: 0,
          duration: 5,
          display_order: 1,
          file_type: "image",
          file_url: `${req.protocol}://${req.get("host")}/uploads/${placeholderPath}`,
          original_name: "handson.png",
          mime_type: "image/png",
        },
      ],
    },
  };
};

// Get active playlist (public endpoint - no authentication required)
export const getActivePlaylistForDisplay = async (req, res) => {
  try {
    const { device_key } = req.query;

    if (!device_key) {
      // If no device_key provided, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Look up device by device_key
    const device = await getDeviceByKey(device_key);

    if (!device) {
      // Device not found, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Update last_seen_at so device shows as online
    await updateDeviceLastSeen(device_key);

    // Get device's group_id
    const deviceGroupId = device.group_id;

    if (!deviceGroupId) {
      // Device has no group assigned, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Get active playlist for device's group
    const playlist = await getActivePlaylist(deviceGroupId);

    if (!playlist) {
      // No playlist found for device group, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Get playlist with all items (no userId check for public access)
    const playlistWithItems = await getPlaylistWithItems(playlist.id, null);

    if (
      !playlistWithItems ||
      !playlistWithItems.items ||
      playlistWithItems.items.length === 0
    ) {
      // Playlist has no items, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Format items with full file URLs
    const formattedItems = playlistWithItems.items.map((item) => ({
      id: item.id,
      file_id: item.file_id,
      duration: item.duration,
      display_order: item.display_order,
      file_type: item.file_type,
      file_url: `${req.protocol}://${req.get("host")}/uploads/${item.file_path}`,
      original_name: item.original_name,
      mime_type: item.mime_type,
    }));

    res.json({
      success: true,
      playlist: {
        id: playlistWithItems.id,
        name: playlistWithItems.name,
        description: playlistWithItems.description,
        status: playlistWithItems.status,
        items: formattedItems,
      },
    });
  } catch (error) {
    console.error("Error fetching active playlist:", error);
    // On error, return placeholder instead of error
    return res.json(getPlaceholderPlaylist(req));
  }
};

// Public endpoint to validate a device key without returning playlist data
export const validateDeviceKey = async (req, res) => {
  try {
    const { device_key } = req.query;

    if (!device_key || device_key.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "device_key is required",
      });
    }

    const device = await getDeviceByKey(device_key.trim());

    if (!device) {
      return res.json({
        success: true,
        valid: false,
      });
    }

    return res.json({
      success: true,
      valid: true,
      device: {
        id: device.id,
        name: device.name,
        group_id: device.group_id,
      },
    });
  } catch (error) {
    console.error("Error validating device key:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Public endpoint for device heartbeat (no authentication required)
export const heartbeatDisplay = async (req, res) => {
  try {
    const { device_key } = req.query;

    if (!device_key || device_key.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "device_key is required",
      });
    }

    const updated = await updateDeviceLastSeen(device_key.trim());

    if (!updated) {
      return res.json({
        success: true,
        valid: false,
      });
    }

    return res.json({
      success: true,
      valid: true,
    });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};