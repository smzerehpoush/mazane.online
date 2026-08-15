/**
 * ⚠️ This route never creates or changes any price number —
 * only slug/title/body/status.
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
