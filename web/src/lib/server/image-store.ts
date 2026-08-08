/**
 * انبار واقعی عکس شاخص پست — فضای ابری آروان (S3-سازگار)، سرو از
 * `MAZANE_IMAGE_CDN_BASE_URL` (بلیت ۲۴).
 *
 * **فقط سمت سرور** (همان دلیل `price-source.ts`: `@aws-sdk/client-s3` و
 * `sharp` هرگز نباید به باندل مرورگر بروند). مصرف‌کننده‌ها توابع این فایل را
 * بگیرند، نه مستقیم از `lib/images.ts` — import همین فایل است که منبع
 * پیش‌فرض را ثبت می‌کند.
 *
 * ⚠️ کلید/بوکت واقعی آروان اینجا نیست و در هیچ تست/کد نمونه‌ای حدس زده
 * نشده — فقط نام متغیرهای محیطی. این مسیر با پستگرس/ردیس واقعی هم مثل
 * بقیه‌ی سرویس‌ها اجرا می‌شود ولی **تست به آن وصل نیست** (بند طراحی تیکت):
 * فِیک درون‌حافظه‌ای `setImageStore` تزریق می‌شود، نه این فایل.
 *
 * پردازش تصویر با `sharp`، همیشه پیش از آپلود:
 *   - تغییر اندازه‌ی حداکثر عرض ۱۶۰۰px، فقط کوچک‌سازی (`withoutEnlargement`)
 *     — عکس کوچک‌تر از ۱۶۰۰ دست‌نخورده می‌ماند.
 *   - تبدیل به webp کیفیت ~۸۲.
 *   - **بدون `.withMetadata()`** — یعنی EXIF/GPS عکسِ گوشی به‌طور پیش‌فرض حذف
 *     می‌شود. این عمدی و یک مزیت حریم خصوصی است: مالک با آپلود عکس گوشی‌اش
 *     مختصات مکانی یا مدل دستگاه را به‌صورت ناخواسته منتشر نمی‌کند.
 *
 * نام شیء از محتوای *پردازش‌شده* مشتق می‌شود (`posts/<slug>/<sha256-hex>.webp`)
 * — پس جایگزینی عکس همیشه شیء تازه می‌سازد؛ CDN هرگز نسخه‌ی کهنه سرو نمی‌کند
 * و پاسخ همیشه می‌تواند کش دائمی (`immutable`) بگیرد.
 *
 * صف تک‌نفره‌ی `image-queue.ts` هر آپلود را سریالی می‌کند — سرور تولید یک
 * هسته دارد و `sharp` پردازنده‌بر است (بند طراحی تیکت).
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

/** حداکثر عرض خروجی — فقط کوچک‌سازی، هرگز بزرگ‌سازی (بند طراحی تیکت). */
const MAX_WIDTH = 1600;
/** کیفیت webp — تعادل حجم/وضوح برای عکس شاخص بلاگ. */
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
    endpoint: requiredEnv("MAZANE_ARVAN_S3_ENDPOINT"),
    region: process.env["MAZANE_ARVAN_S3_REGION"] ?? "default",
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("MAZANE_ARVAN_S3_ACCESS_KEY"),
      secretAccessKey: requiredEnv("MAZANE_ARVAN_S3_SECRET_KEY"),
    },
  });
  return cachedClient;
}

/** پردازش (تغییر اندازه + webp) و آپلود واقعی — بدنه‌ی کاری که صف سریالی می‌کند. */
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
      Bucket: requiredEnv("MAZANE_ARVAN_S3_BUCKET"),
      Key: objectKey,
      Body: processed.data,
      ContentType: "image/webp",
      // محتوامحور و تغییرناپذیر — جایگزینی عکس همیشه کلید تازه می‌سازد.
      CacheControl: "public, max-age=31536000, immutable",
      // بدون این، آروان شیء را خصوصی می‌نویسد و MAZANE_IMAGE_CDN_BASE_URL
      // (نشانی مستقیم باکت — تصمیم مالک، ۲۰۲۶-۰۸-۰۷: بدون زیردامنه‌ی
      // اختصاصی) برای بازدیدکننده‌ی بی‌احرازهویت ۴۰۳ می‌دهد. با کلید واقعی
      // آروان تأیید شد که این پرچم را رعایت می‌کند (بوکت-پالیسی نبود).
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

/** نشانی عمومی نهایی از objectKey — همیشه از زیردامنه‌ی خودمان، نه دامنه‌ی خام انبار. */
export function publicImageUrl(objectKey: string): string {
  const base = requiredEnv("MAZANE_IMAGE_CDN_BASE_URL").replace(/\/+$/, "");
  return `${base}/${objectKey}`;
}

let registered = false;

/** ثبت تنبل — همان الگو و همان دلیلِ `price-source.ts`. */
function ensureDefaultStore(): void {
  if (registered) return;
  registered = true;
  setDefaultImageStore(createS3ImageStore);
}

/** تنها درِ ورود کد سروری به انبار عکس — نه مستقیم از `lib/images.ts`. */
export async function uploadImage(
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<UploadedImage> {
  ensureDefaultStore();
  return domainUpload(slug, bytes, contentType);
}
