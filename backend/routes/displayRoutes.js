import express from "express";
import { getActivePlaylistForDisplay } from "../controllers/displayController.js";

const router = express.Router();

// Public route to get active playlist (no authentication required)
router.get("/display", getActivePlaylistForDisplay);

export default router;

