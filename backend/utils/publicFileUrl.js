import { getSpacesPublicBaseUrl } from "./spacesClient.js";

function isAbsoluteHttpUrl(v) {
  if (typeof v !== "string") return false;
  return /^https?:\/\//i.test(v.trim());
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .replace(/^\/+/, "");
}

export function getPublicFileUrl({ req, key }) {
  if (!key || typeof key !== "string") return null;
  if (isAbsoluteHttpUrl(key)) return key.trim();

  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return null;

  const driver = String(process.env.UPLOAD_DRIVER || "spaces")
    .trim()
    .toLowerCase();

  if (driver === "local") {
    if (!req) {
      throw new Error("getPublicFileUrl requires req when UPLOAD_DRIVER=local");
    }
    return `${req.protocol}://${req.get("host")}/uploads/${normalizedKey}`;
  }

  // spaces (default)
  const base = getSpacesPublicBaseUrl();
  return `${base}/${normalizedKey}`;
}

