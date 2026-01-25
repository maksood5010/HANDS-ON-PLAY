import express from "express";
import {
  getGroupsHandler,
  getGroupHandler,
  createGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  updateGroupDevicesHandler
} from "../controllers/deviceGroupController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Device group routes
router.get("/device-groups", getGroupsHandler);
router.get("/device-groups/:id", getGroupHandler);
router.post("/device-groups", createGroupHandler);
router.put("/device-groups/:id", updateGroupHandler);
router.delete("/device-groups/:id", deleteGroupHandler);
router.put("/device-groups/:id/devices", updateGroupDevicesHandler);

export default router;

