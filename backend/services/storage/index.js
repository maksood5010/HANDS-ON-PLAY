import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSpacesBucket, getSpacesClient } from "../../utils/spacesClient.js";

export async function putObject({ key, body, contentType, cacheControl }) {
  if (!key || typeof key !== "string") {
    throw new Error("putObject requires key");
  }
  if (!body) {
    throw new Error("putObject requires body");
  }

  const client = getSpacesClient();
  const Bucket = getSpacesBucket();

  const normalizedKey = key.replace(/^\/+/, "");

  // IMPORTANT:
  // Many S3-compatible buckets (including Spaces) may have ACLs disabled.
  // In that case, sending `ACL: "public-read"` fails with AccessControlListNotSupported.
  // Prefer bucket policy/CDN for public access, and only send an ACL if explicitly configured.
  const acl = (process.env.SPACES_OBJECT_ACL || "").trim();
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
    // Backward compatibility: if someone configured ACL but the bucket rejects it, retry without.
    const message = String(err?.name || err?.Code || err?.code || err?.message || "");
    const aclNotSupported =
      /AccessControlListNotSupported/i.test(message) ||
      /ACL/i.test(message) ||
      err?.$metadata?.httpStatusCode === 400;

    if (acl && aclNotSupported) {
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

