import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

  try {
    await client.send(
      new PutObjectCommand({
        ...baseParams,
        ...(acl ? { ACL: acl } : {}),
      })
    );
  } catch (err) {
    // If the bucket has ACLs disabled, retry without ACL (rely on bucket policy/CDN).
    if (acl && isAclNotSupportedError(err)) {
      await client.send(new PutObjectCommand(baseParams));
    } else {
      throw err;
    }
  }

  return { key: normalizedKey };
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
