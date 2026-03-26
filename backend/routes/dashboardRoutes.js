import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

// Public dashboard summary endpoint (no authentication)
router.get("/dashboard-summary", getDashboardSummary);

export default router;

