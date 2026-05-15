import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const driver = String(process.env.UPLOAD_DRIVER || "spaces")
  .trim()
  .toLowerCase();
const useLocalDisk = driver === "local";

const rawMb = process.env.PLAYLIST_UPLOAD_MAX_MB;
const parsedMb =
  rawMb !== undefined && rawMb !== "" ? parseInt(String(rawMb).trim(), 10) : NaN;
export const PLAYLIST_UPLOAD_MAX_MB =
  Number.isFinite(parsedMb) && parsedMb > 0 ? Math.min(500, Math.max(1, parsedMb)) : 100;
const maxBytes = PLAYLIST_UPLOAD_MAX_MB * 1024 * 1024;

// Create uploads directory if it doesn't exist (local mode only)
const uploadsDir = path.join(__dirname, "../uploads");
if (useLocalDisk && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = useLocalDisk
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        const userId = req.user?.id || "default";
        const userDir = path.join(uploadsDir, `users/${userId}`);

        // Create user directory if it doesn't exist
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }

        // Create subdirectories for images and videos
        const fileType = file.mimetype.startsWith("image/") ? "images" : "videos";
        const typeDir = path.join(userDir, fileType);

        if (!fs.existsSync(typeDir)) {
          fs.mkdirSync(typeDir, { recursive: true });
        }

        cb(null, typeDir);
      },
      filename: (_req, file, cb) => {
        // Generate unique filename: timestamp-random-originalname
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "_");
        cb(null, `${uniqueSuffix}-${name}${ext}`);
      },
    })
  : multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allow images and videos
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxBytes,
  },
});

const handleMulterError = (err, res, next) => {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `Each file must be ${PLAYLIST_UPLOAD_MAX_MB} MB or smaller`,
    });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: err.message || "Too many files in upload" });
  }
  if (err.message === "Only image and video files are allowed!") {
    return res.status(400).json({ error: err.message });
  }
  return res.status(400).json({ error: err.message || "Upload failed" });
};

/** Single playlist media file (`file` field). */
export const uploadPlaylistFile = (req, res, next) => {
  upload.single("file")(req, res, (err) => handleMulterError(err, res, next));
};

/** Multiple playlist media files (`files` field). */
export const uploadPlaylistFiles = (req, res, next) => {
  upload.array("files")(req, res, (err) => handleMulterError(err, res, next));
};

export default upload;
