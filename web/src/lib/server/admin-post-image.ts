/**
 * منطق ‎POST /api/admin-posts/$slug/image‎ — آپلود عکس شاخص یک پست در پنل
 * مدیریت (بلیت ۲۴).
 *
 * جدا از `admin-posts-requests.ts` نگه‌داشته شده (نه اضافه به آن فایل)
 * چون این مسیر یک نگرانی کاملاً متفاوت دارد: بدنه‌ی چندبخشی/باینری،
 * سقف اندازه، پردازش تصویر و انبار ابری — نه فقط JSON روی جدول `posts`.
 * همان دلیلی که `post-view.ts` از `admin-posts-requests.ts` جداست.
 *
 * قرارداد:
 *     POST /api/admin-posts/$slug/image   multipart/form-data:
 *                                          فیلد «image» (فایل)، فیلد «alt» (متن)
 *          ← 200 {post}   موفق — image_url/alt/width/height روی پست نشست
 *          ← 400 {error}  بدنه نامعتبر، فایل غایب، یا متن جایگزین خالی
 *          ← 404 {error}  پست ناموجود
 *          ← 413 {error}  حجم فایل بیش از سقف
 *          ← 401 {error}  بدون نشست معتبر
 *          ← 502 {error}  انبار عکس در دسترس نیست (قطع منبع — نه خطای کاربر)
 *
 * هر پاسخ: `Cache-Control: no-store` و `X-Robots-Tag: noindex, nofollow`
 * (بند ۹ قراردادها).
 *
 * ⚠️ **مسیر مجزا از ذخیره‌ی متن پست** (`adminPostUpdateResponse`): قطع انبار
 * عکس فقط همین مسیر را می‌شکند، نه ویرایش عنوان/متن — دو route کاملاً جدا،
 * دو تابع کاملاً جدا، هیچ وابستگی مشترکی جز خواندنِ خودِ پست ندارند.
 */
import "@tanstack/react-start/server-only";

import { isValidSlug } from "../admin-posts";
import { json, notFound, unauthorized } from "./admin-http";
import { getAdminPost, setPostImage } from "./admin-posts";
import { hasValidSession } from "./admin-session";
import { publicImageUrl, uploadImage } from "./image-store";

/** سقف اندازه‌ی ورودی — بلیت ۲۴، بند طراحی: پیش از پردازش کامل رد شود. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function tooLarge(): Response {
  return json({ error: "حجم عکس بیش از سقف ۸ مگابایتی است" }, 413);
}

function badRequest(reason: string): Response {
  return json({ error: reason }, 400);
}

function requireSession(request: Request): boolean {
  return hasValidSession(request.headers.get("cookie"));
}

function statusFor(kind: "not_found" | "invalid"): number {
  return kind === "not_found" ? 404 : 400;
}

export async function adminPostImageUploadResponse(
  request: Request,
  slug: string,
): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  if (!isValidSlug(slug)) return notFound();

  // دفاع اول: اگر Content-Length در دسترس است، پیش از خواندنِ حتی یک بایت رد کن.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    return tooLarge();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("بدنه‌ی چندبخشی نامعتبر است");
  }

  const alt = form.get("alt");
  if (typeof alt !== "string" || alt.trim() === "") {
    return badRequest("متن جایگزین عکس نمی‌تواند خالی باشد");
  }

  const file = form.get("image");
  if (!(file instanceof Blob)) {
    return badRequest("فایل عکس یافت نشد");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // دفاع دوم: بلافاصله بعد از خواندن بافر، پیش از فراخوان sharp.
  if (bytes.byteLength > MAX_IMAGE_BYTES) return tooLarge();

  // پیش از هزینه‌ی پردازش/آپلود مطمئن شویم پست وجود دارد.
  const existing = await getAdminPost(slug);
  if (existing === null) return notFound();

  let uploaded: { objectKey: string; width: number; height: number };
  try {
    uploaded = await uploadImage(slug, bytes, file.type || "application/octet-stream");
  } catch (error) {
    console.error("admin-post-image: image store unavailable", error);
    return json({ error: "انبار عکس در دسترس نیست — دوباره تلاش کنید" }, 502);
  }

  const result = await setPostImage(slug, {
    image_url: publicImageUrl(uploaded.objectKey),
    image_alt: alt,
    image_width: uploaded.width,
    image_height: uploaded.height,
  });
  if (!result.ok) return json({ error: result.error }, statusFor(result.kind));
  return json({ post: result.post }, 200);
}

export function adminPostImageMethodNotAllowed(): Response {
  return json({ error: "فقط POST" }, 405, { Allow: "POST" });
}
