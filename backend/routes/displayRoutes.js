import express from "express";
import {
  getActivePlaylistForDisplay,
  validateDeviceKey,
  heartbeatDisplay,
} from "../controllers/displayController.js";

const router = express.Router();

// Public route to get active playlist (no authentication required)
router.get("/display", getActivePlaylistForDisplay);

// Public route to validate a device key (no authentication required)
router.get("/display/validate-key", validateDeviceKey);

// Public route for device heartbeat (no authentication required)
router.get("/display/heartbeat", heartbeatDisplay);

export default router;

