import { getActivePlaylist } from "../models/playlistModel.js";
import { getPlaylistWithItems } from "../models/playlistItemModel.js";
import { getDeviceByKey, updateDeviceLastSeen } from "../models/deviceModel.js";

const getEmptyPlaylistResponse = () => ({
  success: true,
  playlist: {
    id: null,
    name: null,
    description: null,
    status: null,
    items: [],
  },
});

// Get active playlist (public endpoint - no authentication required)
export const getActivePlaylistForDisplay = async (req, res) => {
  try {
    const { device_key } = req.query;

    if (!device_key) {
      return res.status(400).json({
        success: false,
        error: "device_key is required",
      });
    }

    // Look up device by device_key
    const device = await getDeviceByKey(device_key);

    if (!device) {
      // Device not found -> allow client to show its own placeholder UI
      return res.json(getEmptyPlaylistResponse());
    }

    // Update last_seen_at so device shows as online
    await updateDeviceLastSeen(device_key);

    // Get device's group_id
    const deviceGroupId = device.group_id;
    const companyId = device.company_id;

    if (!deviceGroupId || !companyId) {
      // Device has no group/company -> allow client to show its own placeholder UI
      return res.json(getEmptyPlaylistResponse());
    }

    // Get active playlist for device's group
    const playlist = await getActivePlaylist(companyId, deviceGroupId);

    if (!playlist) {
      // No playlist assigned -> allow client to show its own placeholder UI
      return res.json(getEmptyPlaylistResponse());
    }

    // Get playlist with all items (no userId check for public access)
    const playlistWithItems = await getPlaylistWithItems(playlist.id, companyId);

    if (
      !playlistWithItems ||
      !playlistWithItems.items ||
      playlistWithItems.items.length === 0
    ) {
      // Playlist has no items -> allow client to show its own placeholder UI
      return res.json(getEmptyPlaylistResponse());
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
    // Keep displays resilient: return empty payload so client can show local placeholder UI.
    return res.json(getEmptyPlaylistResponse());
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
        company_id: device.company_id,
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