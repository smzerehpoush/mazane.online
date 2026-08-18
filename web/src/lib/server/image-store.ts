/**
 * ⚠️ The real Arvan key/bucket isn't here and isn't guessed at in any
 * test/sample code — only environment variable names. This route runs
 * against real Postgres/Redis just like the rest of the services, but
 * **no test connects to it** (per the ticket's design note): the
 * in-memory fake `setImageStore` is injected instead, not this file.
 */
import "@tanstack/react-start/server-only";

import { createHash } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import {
  setDefaultImageStore,
  uploadImage as domainUpload,
  type ImageStore,
  type UploadedImage,
  type UploadedImageVariant,
} from "../images";
import { enqueueImageJob } from "./image-queue";

const MAX_WIDTH = 1600;
const VARIANT_WIDTHS: readonly number[] = [160, 480, 800, 1200];
const WEBP_QUALITY = 82;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`environment variable ${name} is not set — image store is unavailable`);
  }
  return value;
}

let cachedClient: S3Client | null = null;

function s3Client(): S3Client {
  if (cachedClient !== null) return cachedClient;
  cachedClient = new S3Client({
    endpoint: requiredEnv("TABLO_ARVAN_S3_ENDPOINT"),
    region: process.env["TABLO_ARVAN_S3_REGION"] ?? "default",
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("TABLO_ARVAN_S3_ACCESS_KEY"),
      secretAccessKey: requiredEnv("TABLO_ARVAN_S3_SECRET_KEY"),
    },
  });
  return cachedClient;
}

type SharpInstance = ReturnType<typeof sharp>;

function encodeWebp(source: SharpInstance, width: number) {
  return (
    source
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      // Without withMetadata(): EXIF/GPS is stripped by default (a privacy benefit).
      .toBuffer({ resolveWithObject: true })
  );
}

async function putWebp(objectKey: string, body: Buffer): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: requiredEnv("TABLO_ARVAN_S3_BUCKET"),
      Key: objectKey,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    }),
  );
}

async function processAndUpload(slug: string, bytes: Uint8Array): Promise<UploadedImage> {
  const source = sharp(Buffer.from(bytes));
  const processed = await encodeWebp(source, MAX_WIDTH);

  const hash = createHash("sha256").update(processed.data).digest("hex");
  const objectKey = `posts/${slug}/${hash}.webp`;

  await putWebp(objectKey, processed.data);

  const variants: UploadedImageVariant[] = [];
  for (const width of VARIANT_WIDTHS) {
    if (width >= processed.info.width) continue;
    const variant = await encodeWebp(source, width);
    const variantKey = `posts/${slug}/${hash}-${variant.info.width}.webp`;
    await putWebp(variantKey, variant.data);
    variants.push({ objectKey: variantKey, width: variant.info.width });
  }

  return {
    objectKey,
    width: processed.info.width,
    height: processed.info.height,
    variants,
  };
}

export function createS3ImageStore(): ImageStore {
  return {
    upload: (slug, bytes) => enqueueImageJob(() => processAndUpload(slug, bytes)),
  };
}

/**
 * ⚠️ **Deliberate deviation from the design note** ("no foreign domain
 * sits on the critical render path"): owner's decision 2026-08-07,
 * confirmed 2026-08-10 — not `cdn.tablo.gold`, nor any other subdomain.
 * The consequence is that the Arvan domain is visible in the page HTML,
 * and if you ever switch Arvan providers, every old image URL breaks.
 */
export function publicImageUrl(objectKey: string): string {
  const endpoint = requiredEnv("TABLO_ARVAN_S3_ENDPOINT").replace(/\/+$/, "");
  const bucket = requiredEnv("TABLO_ARVAN_S3_BUCKET");
  return `${endpoint}/${bucket}/${objectKey}`;
}

let registered = false;

function ensureDefaultStore(): void {
  if (registered) return;
  registered = true;
  setDefaultImageStore(createS3ImageStore);
}

export async function uploadImage(
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<UploadedImage> {
  ensureDefaultStore();
  return domainUpload(slug, bytes, contentType);
}
