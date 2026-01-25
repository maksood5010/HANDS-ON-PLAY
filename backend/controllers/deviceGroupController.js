import {
  getGroupsByUserId,
  getGroupById,
  getDevicesInGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  updateGroupDevices,
  canUserAccessGroup
} from "../models/deviceGroupModel.js";

// Get all groups (global + user's groups)
export const getGroupsHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await getGroupsByUserId(userId);
    res.json({ success: true, groups });
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get single group
export const getGroupHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const group = await getGroupById(parseInt(id), userId);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Get devices in this group
    const devices = await getDevicesInGroup(parseInt(id), userId);
    group.devices = devices;

    res.json({ success: true, group });
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new group
export const createGroupHandler = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    const group = await createGroup(name.trim(), userId);
    res.status(201).json({ success: true, group });
  } catch (error) {
    console.error("Error creating group:", error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: "A group with this name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update group name
export const updateGroupHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    // Check if group exists and is user-owned (not global)
    const group = await getGroupById(parseInt(id), userId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.user_id === null) {
      return res.status(403).json({ error: "Cannot edit the global 'All devices' group" });
    }

    const updatedGroup = await updateGroup(parseInt(id), name.trim(), userId);
    
    if (!updatedGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ success: true, group: updatedGroup });
  } catch (error) {
    console.error("Error updating group:", error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: "A group with this name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete group
export const deleteGroupHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if group exists and is user-owned (not global)
    const group = await getGroupById(parseInt(id), userId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.user_id === null) {
      return res.status(403).json({ error: "Cannot delete the global 'All devices' group" });
    }

    const deletedGroup = await deleteGroup(parseInt(id), userId);
    
    if (!deletedGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ success: true, message: "Group deleted successfully. Devices moved to 'All devices' group." });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update devices in a group
export const updateGroupDevicesHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceIds } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(deviceIds)) {
      return res.status(400).json({ error: "deviceIds must be an array" });
    }

    // Check if group exists and user can access it
    const canAccess = await canUserAccessGroup(parseInt(id), userId);
    if (!canAccess) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Convert deviceIds to integers
    const deviceIdsInt = deviceIds.map(id => parseInt(id)).filter(id => !isNaN(id));

    await updateGroupDevices(parseInt(id), deviceIdsInt, userId);

    // Return updated group with devices
    const group = await getGroupById(parseInt(id), userId);
    const devices = await getDevicesInGroup(parseInt(id), userId);
    group.devices = devices;

    res.json({ success: true, group });
  } catch (error) {
    console.error("Error updating group devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

