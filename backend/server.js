import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import displayRoutes from "./routes/displayRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import deviceGroupRoutes from "./routes/deviceGroupRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5041;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve client display app
app.use("/client", express.static(path.join(__dirname, "../client")));

// API Routes
app.use("/api", messageRoutes);
app.use("/api", authRoutes);
app.use("/api", playlistRoutes);
app.use("/api", deviceRoutes);
app.use("/api", deviceGroupRoutes);

// Public display routes (no authentication required)
app.use("/", displayRoutes);

// Serve static files from React app
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Catch all handler: send back React's index.html file
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
