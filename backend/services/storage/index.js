import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSpacesBucket, getSpacesClient } from "../../utils/spacesClient.js";

const SKIP_ACL_VALUES = new Set(["", "none", "off", "false", "disabled"]);

/**
 * Resolve S3/Spaces ACL for uploads.
 * - Default: public-read (logos and playlist media must be readable via CDN/browser).
 * - SPACES_OBJECT_ACL=none (or off/false/disabled): omit ACL (bucket policy must grant public access).
 * - SPACES_OBJECT_ACL=public-read (or any other S3 ACL): use that value.
 */
export function resolveObjectAcl(explicitAcl) {
  if (explicitAcl !== undefined) {
    const trimmed = String(explicitAcl).trim();
    if (SKIP_ACL_VALUES.has(trimmed.toLowerCase())) return "";
    return trimmed;
  }

  const env = process.env.SPACES_OBJECT_ACL;
  if (env === undefined) return "public-read";
  const trimmed = String(env).trim();
  if (SKIP_ACL_VALUES.has(trimmed.toLowerCase())) return "";
  return trimmed;
}

function isAclNotSupportedError(err) {
  const message = String(err?.name || err?.Code || err?.code || err?.message || "");
  return (
    /AccessControlListNotSupported/i.test(message) ||
    /ACL/i.test(message) ||
    err?.$metadata?.httpStatusCode === 400
  );
}

export async function putObject({ key, body, contentType, cacheControl, acl: aclOption }) {
  if (!key || typeof key !== "string") {
    throw new Error("putObject requires key");
  }
  if (!body) {
    throw new Error("putObject requires body");
  }

  const client = getSpacesClient();
  const Bucket = getSpacesBucket();

  const normalizedKey = key.replace(/^\/+/, "");
  const acl = resolveObjectAcl(aclOption);

  const baseParams = {
    Bucket,
    Key: normalizedKey,
    Body: body,
    ContentType: contentType || undefined,
    CacheControl: cacheControl || undefined,
  };

  const logTiming =
    process.env.UPLOAD_TIMING_LOGS === "true" ||
    process.env.UPLOAD_TIMING_LOGS === "1" ||
    process.env.NODE_ENV !== "production";

  try {
    const sendStarted = Date.now();
    await client.send(
      new PutObjectCommand({
        ...baseParams,
        ...(acl ? { ACL: acl } : {}),
      })
    );
    if (logTiming) {
      const bodyBytes = Buffer.isBuffer(body) ? body.length : 0;
      console.log(
        `[upload:spaces] PutObject ok ${(bodyBytes / (1024 * 1024)).toFixed(2)}MB in ${Date.now() - sendStarted}ms key=${normalizedKey} acl=${acl || "none"}`
      );
    }
  } catch (err) {
    // If the bucket has ACLs disabled, retry without ACL (rely on bucket policy/CDN).
    if (acl && isAclNotSupportedError(err)) {
      const retryStarted = Date.now();
      await client.send(new PutObjectCommand(baseParams));
      if (logTiming) {
        console.log(
          `[upload:spaces] PutObject retry without ACL in ${Date.now() - retryStarted}ms key=${normalizedKey}`
        );
      }
    } else {
      throw err;
    }
  }

  return { key: normalizedKey };
}

export async function getObject({ key }) {
  if (!key || typeof key !== "string") {
    throw new Error("getObject requires key");
  }

  const client = getSpacesClient();
  const Bucket = getSpacesBucket();
  const normalizedKey = key.replace(/^\/+/, "");

  const response = await client.send(
    new GetObjectCommand({
      Bucket,
      Key: normalizedKey,
    })
  );

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject({ key }) {
  if (!key || typeof key !== "string") return;

  const client = getSpacesClient();
  const Bucket = getSpacesBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket,
      Key: key.replace(/^\/+/, ""),
    })
  );
}
