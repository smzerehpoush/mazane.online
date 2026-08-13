/**
 * ⚠️ کلید/بوکت واقعی آروان اینجا نیست و در هیچ تست/کد نمونه‌ای حدس زده
 * نشده — فقط نام متغیرهای محیطی. این مسیر با پستگرس/ردیس واقعی هم مثل
 * بقیه‌ی سرویس‌ها اجرا می‌شود ولی **تست به آن وصل نیست** (بند طراحی تیکت):
 * فِیک درون‌حافظه‌ای `setImageStore` تزریق می‌شود، نه این فایل.
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
} from "../images";
import { enqueueImageJob } from "./image-queue";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`متغیر محیطی ${name} تنظیم نشده — انبار عکس در دسترس نیست`);
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

async function processAndUpload(slug: string, bytes: Uint8Array): Promise<UploadedImage> {
  const processed = await sharp(Buffer.from(bytes))
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    // بدون withMetadata(): EXIF/GPS به‌طور پیش‌فرض حذف می‌شود (مزیت حریم خصوصی — بالای فایل).
    .toBuffer({ resolveWithObject: true });

  const hash = createHash("sha256").update(processed.data).digest("hex");
  const objectKey = `posts/${slug}/${hash}.webp`;

  await s3Client().send(
    new PutObjectCommand({
      Bucket: requiredEnv("TABLO_ARVAN_S3_BUCKET"),
      Key: objectKey,
      Body: processed.data,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    }),
  );

  return { objectKey, width: processed.info.width, height: processed.info.height };
}

export function createS3ImageStore(): ImageStore {
  return {
    upload: (slug, bytes) => enqueueImageJob(() => processAndUpload(slug, bytes)),
  };
}

/**
 * ⚠️ **انحراف عمدی از بند طراحی ** («هیچ دامنه‌ی بیگانه‌ای روی مسیر
 * بحرانی رندر ننشیند»): تصمیم مالک ۲۰۲۶-۰۸-۰۷، تأییدشده ۲۰۲۶-۰۸-۱۰ — نه
 * `cdn.tablo.gold` و نه هیچ زیردامنه‌ی دیگری. پیامدش این است که دامنه‌ی
 * آروان در HTML صفحه دیده می‌شود و اگر روزی آروان را عوض کنید، نشانی همه‌ی
 * عکس‌های قدیمی می‌شکند.
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
