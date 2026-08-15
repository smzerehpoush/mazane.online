/**
 * ⚠️ **Separate route from saving post text** (`adminPostUpdateResponse`):
 * an image-store outage only breaks this route, not editing the
 * title/body — two completely separate routes, two completely separate
 * functions, sharing no dependency except reading the post itself.
 */
import "@tanstack/react-start/server-only";

import { isValidSlug } from "../admin-posts";
import { json, notFound, unauthorized } from "./admin-http";
import { getAdminPost, setPostImage } from "./admin-posts";
import { hasValidSession } from "./admin-session";
import { publicImageUrl, uploadImage } from "./image-store";

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
  if (bytes.byteLength > MAX_IMAGE_BYTES) return tooLarge();

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
