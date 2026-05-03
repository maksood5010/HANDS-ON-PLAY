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

const driver = String(process.env.UPLOAD_DRIVER || "spaces")
  .trim()
  .toLowerCase();
const useLocalDisk = driver === "local";

if (useLocalDisk) {
  // Ensure base folders exist
  ensureDir(uploadsDir);
  ensureDir(path.join(uploadsDir, "companies"));
  ensureDir(path.join(uploadsDir, "tmp"));
  ensureDir(path.join(uploadsDir, "tmp/company-logos"));
}

const storage = useLocalDisk
  ? multer.diskStorage({
      destination: (req, _file, cb) => {
        // For update routes: company id is known -> store directly in company folder.
        const rawCompanyId = req.params?.id;
        const companyId = Number.isFinite(parseInt(rawCompanyId, 10))
          ? parseInt(rawCompanyId, 10)
          : null;

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
    })
  : multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith("image/")) return cb(null, true);
  return cb(new Error("Only image files are allowed"), false);
};

/** Max logo size in MB (env override). Default 20; clamped 1–50. */
const rawMb = process.env.COMPANY_LOGO_MAX_MB;
const parsedMb =
  rawMb !== undefined && rawMb !== "" ? parseInt(String(rawMb).trim(), 10) : NaN;
export const COMPANY_LOGO_MAX_MB =
  Number.isFinite(parsedMb) && parsedMb > 0 ? Math.min(50, Math.max(1, parsedMb)) : 20;
const maxBytes = COMPANY_LOGO_MAX_MB * 1024 * 1024;

const companyLogoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxBytes,
  },
});

/**
 * Use instead of `companyLogoUpload.single("logo")` so LIMIT_FILE_SIZE returns JSON, not a crash.
 */
export const uploadCompanyLogo = (req, res, next) => {
  companyLogoUpload.single("logo")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `Company logo must be ${COMPANY_LOGO_MAX_MB} MB or smaller`,
      });
    }
    if (err.message === "Only image files are allowed") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || "Upload failed" });
  });
};

export default companyLogoUpload;

