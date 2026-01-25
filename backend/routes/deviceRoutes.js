import express from "express";
import {
  createDeviceHandler,
  getDevicesHandler,
  getDeviceHandler,
  deleteDeviceHandler,
  assignPlaylistHandler
} from "../controllers/deviceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Device CRUD routes
router.post("/devices", createDeviceHandler);
router.get("/devices", getDevicesHandler);
router.get("/devices/:id", getDeviceHandler);
router.delete("/devices/:id", deleteDeviceHandler);
router.put("/devices/:id/playlist", assignPlaylistHandler);

export default router;
