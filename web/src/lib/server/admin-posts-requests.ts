/**
 * منطق ‎/api/admin-posts…‎ — فهرست/ساخت/ویرایش/انتشار/پس‌گیری پست در پنل
 * (بلیت ۲۲).
 *
 * جدا از مسیر، تا مرز تست وب بتواند رفتار را با منبع تزریق‌شده بسنجد —
 * همان الگوی `post-view.ts`/`admin-platform-settings.ts`.
 *
 * قرارداد:
 *     GET  /api/admin-posts                    ← 200 {posts:[...]}  | 401
 *     POST /api/admin-posts        {slug,title_fa,body_md}
 *          ← 201 {post}  | 400 {error}  | 401
 *
 *     GET  /api/admin-posts/$slug               ← 200 {post} | 404 | 401
 *     POST /api/admin-posts/$slug  {title_fa,body_md,meaningfulEdit}
 *          ← 200 {post}  | 400 {error}  | 404 {error}  | 401
 *
 *     POST /api/admin-posts/$slug/publish       ← 200 {post} | 400 | 404 | 401
 *     POST /api/admin-posts/$slug/retract       ← 200 {post} | 400 | 404 | 401
 *
 * هر پاسخ: `Cache-Control: no-store` و `X-Robots-Tag: noindex, nofollow`
 * (بند ۹ قراردادها) — این مسیرها زیر `/admin/*` نیستند، پس میان‌افزار
 * سراسری `adminSecurityMiddleware` آن‌ها را نمی‌پوشاند و خودشان می‌گذارند
 * (همان دلیل `admin-platform-settings.ts`).
 *
 * ⚠️ قاعده‌ی سخت ۱: این مسیر هیچ عدد قیمتی نمی‌سازد یا تغییر نمی‌دهد —
 * فقط اسلاگ/عنوان/متن/وضعیت.
 */
import "@tanstack/react-start/server-only";

import { isValidSlug } from "../admin-posts";
import { json, notFound, unauthorized } from "./admin-http";
import {
  createPost,
  getAdminPost,
  listAllPosts,
  publishPost,
  retractPost,
  updatePost,
} from "./admin-posts";
import { hasValidSession } from "./admin-session";

/** بدنه‌ی معتبر چند کیلوبایت است (تیتر + متن مارک‌داون)؛ بقیه‌اش سوءاستفاده است. */
const MAX_BODY_BYTES = 262_144;

function requireSession(request: Request): boolean {
  return hasValidSession(request.headers.get("cookie"));
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/* ------------------------------------------------------- GET/POST /api/admin-posts */

export async function adminPostsListResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  const posts = await listAllPosts();
  return json({ posts }, 200);
}

interface CreateBody {
  slug?: unknown;
  title_fa?: unknown;
  body_md?: unknown;
}

export async function adminPostsCreateResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return json({ error: "بدنه نامعتبر است" }, 400);
  const body = parsed.value as CreateBody;
  if (
    typeof body.slug !== "string" ||
    typeof body.title_fa !== "string" ||
    typeof body.body_md !== "string"
  ) {
    return json({ error: "بدنه نامعتبر است" }, 400);
  }

  const result = await createPost(
    { slug: body.slug, title_fa: body.title_fa, body_md: body.body_md },
    new Date().toISOString(),
  );
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ post: result.post }, 201);
}

export function adminPostsMethodNotAllowed(): Response {
  return json({ error: "فقط GET/POST" }, 405, { Allow: "GET, POST" });
}

/* -------------------------------------------------- GET/POST /api/admin-posts/$slug */

export async function adminPostGetResponse(request: Request, slug: string): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  if (!isValidSlug(slug)) return notFound();

  const post = await getAdminPost(slug);
  if (post === null) return notFound();
  return json({ post }, 200);
}

interface UpdateBody {
  title_fa?: unknown;
  body_md?: unknown;
  meaningfulEdit?: unknown;
}

function statusFor(kind: "not_found" | "invalid"): number {
  return kind === "not_found" ? 404 : 400;
}

export async function adminPostUpdateResponse(request: Request, slug: string): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  if (!isValidSlug(slug)) return notFound();

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return json({ error: "بدنه نامعتبر است" }, 400);
  const body = parsed.value as UpdateBody;
  if (typeof body.title_fa !== "string" || typeof body.body_md !== "string") {
    return json({ error: "بدنه نامعتبر است" }, 400);
  }
  // تیک صریح — هر مقدار دیگری (غایب، رشته، ...) یعنی «معنادار نبود».
  const meaningfulEdit = body.meaningfulEdit === true;

  const result = await updatePost(
    slug,
    { title_fa: body.title_fa, body_md: body.body_md, meaningfulEdit },
    new Date().toISOString(),
  );
  if (!result.ok) return json({ error: result.error }, statusFor(result.kind));
  return json({ post: result.post }, 200);
}

export function adminPostMethodNotAllowed(): Response {
  return json({ error: "فقط GET/POST" }, 405, { Allow: "GET, POST" });
}

/* --------------------------------------------- POST /api/admin-posts/$slug/publish */

export async function adminPostPublishResponse(request: Request, slug: string): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  if (!isValidSlug(slug)) return notFound();

  const result = await publishPost(slug, new Date().toISOString());
  if (!result.ok) return json({ error: result.error }, statusFor(result.kind));
  return json({ post: result.post }, 200);
}

export function adminPostPublishMethodNotAllowed(): Response {
  return json({ error: "فقط POST" }, 405, { Allow: "POST" });
}

/* --------------------------------------------- POST /api/admin-posts/$slug/retract */

export async function adminPostRetractResponse(request: Request, slug: string): Promise<Response> {
  if (!requireSession(request)) return unauthorized();
  if (!isValidSlug(slug)) return notFound();

  const result = await retractPost(slug);
  if (!result.ok) return json({ error: result.error }, statusFor(result.kind));
  return json({ post: result.post }, 200);
}

export function adminPostRetractMethodNotAllowed(): Response {
  return json({ error: "فقط POST" }, 405, { Allow: "POST" });
}
