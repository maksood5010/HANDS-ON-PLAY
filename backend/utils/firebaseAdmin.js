import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let app;

function resolveServiceAccountPath(rawPath) {
  if (!rawPath) return null;

  // Common case: server runs with cwd = backend/, but env points to backend/keys/...
  // Try a few resolutions to be robust.
  const candidates = [
    path.resolve(process.cwd(), rawPath),
    path.resolve(process.cwd(), "..", rawPath),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export function getFirebaseAdmin() {
  if (app) return app;

  // Prefer explicit service account to avoid path/cwd surprises.
  const rawCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credPath = resolveServiceAccountPath(rawCredPath);

  if (!admin.apps?.length) {
    if (credPath && fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf8"));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(`Firebase Admin initialized with credentials at ${credPath}`);
    } else {
      app = admin.initializeApp();
      console.warn(
        `Firebase Admin initialized with default credentials (GOOGLE_APPLICATION_CREDENTIALS not found at ${credPath})`
      );
    }
  } else {
    app = admin.app();
  }
  return app;
}

export function getFirebaseMessaging() {
  return getFirebaseAdmin().messaging();
}

