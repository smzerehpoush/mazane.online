import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { getPublishedPost } from "./blog-source";
import { recordPostView } from "./view-counter";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MAX_BODY_BYTES = 512;

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
}

function badRequest(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 400,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE },
  });
}

export async function postViewResponse(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return badRequest("بدنه بیش از حد بزرگ است");

  let slug: unknown;
  try {
    const body: unknown = JSON.parse(raw);
    slug = typeof body === "object" && body !== null ? (body as { slug?: unknown }).slug : undefined;
  } catch {
    return badRequest("بدنه JSON معتبر نیست");
  }

  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    return badRequest("اسلاگ نامعتبر است");
  }

  try {
    const post = await getPublishedPost(slug);
    if (post !== null) await recordPostView(slug);
  } catch (error) {
    console.error("post-view: could not record view", error);
  }

  return noContent();
}

export function postViewMethodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "فقط POST" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
      Allow: "POST",
    },
  });
}
