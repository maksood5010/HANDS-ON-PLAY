import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../uploads");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Ensure base folders exist
ensureDir(uploadsDir);
ensureDir(path.join(uploadsDir, "companies"));
ensureDir(path.join(uploadsDir, "tmp"));
ensureDir(path.join(uploadsDir, "tmp/company-logos"));

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // For update routes: company id is known -> store directly in company folder.
    const rawCompanyId = req.params?.id;
    const companyId = Number.isFinite(parseInt(rawCompanyId, 10)) ? parseInt(rawCompanyId, 10) : null;

    if (companyId) {
      const companyDir = path.join(uploadsDir, `companies/${companyId}`);
      ensureDir(companyDir);
      return cb(null, companyDir);
    }

    // For create routes: company id isn't known yet -> store in tmp then move after insert.
    return cb(null, path.join(uploadsDir, "tmp/company-logos"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `logo-${uniqueSuffix}${ext || ""}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith("image/")) return cb(null, true);
  return cb(new Error("Only image files are allowed"), false);
};

const companyLogoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default companyLogoUpload;

