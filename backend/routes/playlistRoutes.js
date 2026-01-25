import express from "express";
import {
  createPlaylistHandler,
  getPlaylistsHandler,
  getPlaylistHandler,
  updatePlaylistHandler,
  deletePlaylistHandler,
  uploadFileToPlaylistHandler,
  getPlaylistItemsHandler,
  updateItemDurationHandler,
  updateItemOrderHandler,
  deleteItemHandler,
  setPlaylistActiveHandler,
  setPlaylistInactiveHandler,
  schedulePlaylistHandler
} from "../controllers/playlistController.js";
import { authenticate } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Playlist CRUD routes
router.post("/playlists", createPlaylistHandler);
router.get("/playlists", getPlaylistsHandler);
router.get("/playlists/:id", getPlaylistHandler);
router.put("/playlists/:id", updatePlaylistHandler);
router.delete("/playlists/:id", deletePlaylistHandler);
router.post("/playlists/:id/activate", setPlaylistActiveHandler);
router.post("/playlists/:id/deactivate", setPlaylistInactiveHandler);
router.post("/playlists/:id/schedule", schedulePlaylistHandler);

// Playlist items routes
router.get("/playlists/:id/items", getPlaylistItemsHandler);
router.post("/playlists/:playlistId/upload", upload.single("file"), uploadFileToPlaylistHandler);
router.put("/playlist-items/:itemId/duration", updateItemDurationHandler);
router.put("/playlist-items/:itemId/order", updateItemOrderHandler);
router.delete("/playlist-items/:itemId", deleteItemHandler);

export default router;

