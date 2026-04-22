import {
  getGroupsByCompanyId,
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
    const companyId = req.user.company_id;
    const groups = await getGroupsByCompanyId(companyId);
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
    const companyId = req.user.company_id;

    const group = await getGroupById(parseInt(id), companyId);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Get devices in this group
    const devices = await getDevicesInGroup(parseInt(id), companyId);
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
    const companyId = req.user.company_id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    const group = await createGroup(companyId, name.trim(), userId);
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
    const companyId = req.user.company_id;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    // Check if group exists and is user-owned (not global)
    const group = await getGroupById(parseInt(id), companyId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.user_id === null) {
      return res.status(403).json({ error: "Cannot edit the global 'All devices' group" });
    }

    const updatedGroup = await updateGroup(parseInt(id), companyId, name.trim());
    
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
    const companyId = req.user.company_id;

    // Check if group exists and is user-owned (not global)
    const group = await getGroupById(parseInt(id), companyId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.user_id === null) {
      return res.status(403).json({ error: "Cannot delete the global 'All devices' group" });
    }

    const deletedGroup = await deleteGroup(parseInt(id), companyId);
    
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
    const companyId = req.user.company_id;

    if (!Array.isArray(deviceIds)) {
      return res.status(400).json({ error: "deviceIds must be an array" });
    }

    const group = await getGroupById(parseInt(id), companyId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.user_id === null) {
      return res.status(403).json({ error: "Cannot edit devices in the global 'All devices' group" });
    }

    // Check if group exists and user can access it
    const canAccess = await canUserAccessGroup(parseInt(id), companyId);
    if (!canAccess) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Convert deviceIds to integers
    const deviceIdsInt = deviceIds.map(id => parseInt(id)).filter(id => !isNaN(id));

    await updateGroupDevices(parseInt(id), companyId, deviceIdsInt);

    // Return updated group with devices
    const updated = await getGroupById(parseInt(id), companyId);
    const devices = await getDevicesInGroup(parseInt(id), companyId);
    updated.devices = devices;

    res.json({ success: true, group: updated });
  } catch (error) {
    console.error("Error updating group devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

