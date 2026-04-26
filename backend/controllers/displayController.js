import { getActivePlaylistWithMeta } from "../models/playlistModel.js";
import { getPlaylistWithItems } from "../models/playlistItemModel.js";
import { getDeviceByKey, updateDeviceLastSeen } from "../models/deviceModel.js";
import pool from "../config/db.js";

function toTs(v) {
  const t = new Date(v ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function chooseWinner(a, b) {
  // a/b are: { playlist, class } where class is 'scheduled' | 'active' | null
  if (a?.playlist && !b?.playlist) return a;
  if (b?.playlist && !a?.playlist) return b;
  if (!a?.playlist && !b?.playlist) return { playlist: null, class: null, source: null };

  const aIsScheduled = a.class === "scheduled";
  const bIsScheduled = b.class === "scheduled";
  if (aIsScheduled !== bIsScheduled) return aIsScheduled ? a : b;

  const aUpdated = toTs(a.playlist.updated_at);
  const bUpdated = toTs(b.playlist.updated_at);
  if (aUpdated !== bUpdated) return aUpdated > bUpdated ? a : b;

  const aCreated = toTs(a.playlist.created_at);
  const bCreated = toTs(b.playlist.created_at);
  if (aCreated !== bCreated) return aCreated > bCreated ? a : b;

  // Stable fallback
  return a;
}

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

    // Pick best candidate across:
    // - Device's own group
    // - Special "All devices" group
    let playlist = null;
    let groupCandidate = { playlist: null, class: null, source: null };
    let allCandidate = { playlist: null, class: null, source: null };
    try {
      const allRes = await pool.query(
        `SELECT id
         FROM device_groups
         WHERE company_id = $1
           AND user_id IS NULL
           AND name = 'All devices'
         LIMIT 1`,
        [companyId]
      );
      const allGroupId = allRes.rows[0]?.id ?? null;
      const [pGroup, pAll] = await Promise.all([
        getActivePlaylistWithMeta(companyId, deviceGroupId),
        allGroupId
          ? getActivePlaylistWithMeta(companyId, allGroupId)
          : { playlist: null, class: null, source: null },
      ]);
      groupCandidate = pGroup;
      allCandidate = pAll;
    } catch (e) {
      // Don't break playback if the all-devices lookup fails; still try device group.
      console.warn("All-devices lookup failed:", e?.message ?? e);
      groupCandidate = await getActivePlaylistWithMeta(companyId, deviceGroupId);
    }

    const winner = chooseWinner(allCandidate, groupCandidate);
    playlist = winner.playlist;

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

    let placeholderLogoUrl = null;
    try {
      if (device.company_id) {
        const companyRes = await pool.query(
          `SELECT id, logo_path
           FROM companies
           WHERE id = $1
           LIMIT 1`,
          [device.company_id]
        );
        const logoPath = companyRes.rows[0]?.logo_path || null;
        if (logoPath) {
          placeholderLogoUrl = `${req.protocol}://${req.get("host")}/uploads/${logoPath}`;
        }
      }
    } catch (e) {
      // Keep validate-key resilient; placeholder is optional.
      console.warn("Failed to load company logo for validate-key:", e?.message ?? e);
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
      company: {
        id: device.company_id ?? null,
        placeholderLogoUrl,
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