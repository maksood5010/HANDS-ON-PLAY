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

  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: key.replace(/^\/+/, ""),
      Body: body,
      ContentType: contentType || undefined,
      CacheControl: cacheControl || undefined,
      ACL: "public-read",
    })
  );

  return { key: key.replace(/^\/+/, "") };
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

