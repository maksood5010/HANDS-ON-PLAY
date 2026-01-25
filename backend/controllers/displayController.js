import { getActivePlaylist } from "../models/playlistModel.js";
import { getPlaylistWithItems } from "../models/playlistItemModel.js";
import { getDeviceByKey } from "../models/deviceModel.js";

// Helper function to return placeholder playlist
const getPlaceholderPlaylist = (req) => {
  const placeholderPath = "users/1/placeholder/handson.png";
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
          file_url: `${req.protocol}://${req.get('host')}/uploads/${placeholderPath}`,
          original_name: "handson.png",
          mime_type: "image/png"
        }
      ]
    }
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

    if (!playlistWithItems || !playlistWithItems.items || playlistWithItems.items.length === 0) {
      // Playlist has no items, return placeholder
      return res.json(getPlaceholderPlaylist(req));
    }

    // Format items with full file URLs
    const formattedItems = playlistWithItems.items.map(item => ({
      id: item.id,
      file_id: item.file_id,
      duration: item.duration,
      display_order: item.display_order,
      file_type: item.file_type,
      file_url: `${req.protocol}://${req.get('host')}/uploads/${item.file_path}`,
      original_name: item.original_name,
      mime_type: item.mime_type
    }));

    res.json({
      success: true,
      playlist: {
        id: playlistWithItems.id,
        name: playlistWithItems.name,
        description: playlistWithItems.description,
        status: playlistWithItems.status,
        items: formattedItems
      }
    });
  } catch (error) {
    console.error("Error fetching active playlist:", error);
    // On error, return placeholder instead of error
    return res.json(getPlaceholderPlaylist(req));
  }
};

