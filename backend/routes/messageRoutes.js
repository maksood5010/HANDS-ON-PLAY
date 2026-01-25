import express from "express";
import { getMessage } from "../controllers/messageController.js";

const router = express.Router();

router.get("/message", getMessage);

export default router;

