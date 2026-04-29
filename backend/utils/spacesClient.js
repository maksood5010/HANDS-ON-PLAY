import { S3Client } from "@aws-sdk/client-s3";

let _client = null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(v).trim();
}

function optionalEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) return null;
  return String(v).trim();
}

function normalizeEndpoint(raw) {
  // AWS SDK should use the *region* endpoint, e.g. https://fra1.digitaloceanspaces.com
  // If we pass a bucket endpoint (https://<bucket>.<region>.digitaloceanspaces.com),
  // the SDK will prepend the bucket again, producing:
  //   <bucket>.<bucket>.<region>.digitaloceanspaces.com
  //
  // To keep env simple, accept either input and normalize to the region endpoint.
  const url = new URL(raw);
  const host = url.host.toLowerCase();
  const region = optionalEnv("DIGITALOCEAN_SPACES_REGION");
  const bucket = optionalEnv("DIGITALOCEAN_SPACES_NAME");

  if (region) {
    const regionHost = `${region}.digitaloceanspaces.com`;

    // If user supplied a bucket endpoint like "<bucket>.<region>.digitaloceanspaces.com"
    // normalize to "<region>.digitaloceanspaces.com".
    if (bucket && host === `${bucket}.${regionHost}`) {
      return `${url.protocol}//${regionHost}`;
    }

    // If user already supplied a region endpoint, keep it.
    if (host === regionHost) {
      return `${url.protocol}//${regionHost}`;
    }
  }

  // Fallback: keep whatever was provided.
  return url.toString().replace(/\/+$/, "");
}

export function getSpacesBucket() {
  return requireEnv("DIGITALOCEAN_SPACES_NAME");
}

export function getSpacesPublicBaseUrl() {
  // Prefer CDN endpoint if set; fallback to the Spaces endpoint.
  return (
    optionalEnv("DIGITALOCEAN_SPACES_CDN_END_POINT") ||
    requireEnv("DIGITALOCEAN_SPACES_ENDPOINT")
  ).replace(/\/+$/, "");
}

export function getSpacesClient() {
  if (_client) return _client;

  const accessKeyId = requireEnv("DIGITALOCEAN_ACCESS_KEY");
  const secretAccessKey = requireEnv("DIGITALOCEAN_SECRET_KEY");
  const endpoint = normalizeEndpoint(requireEnv("DIGITALOCEAN_SPACES_ENDPOINT"));
  const region = requireEnv("DIGITALOCEAN_SPACES_REGION");

  _client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  return _client;
}

