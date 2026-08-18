/**
 * ⚠️ **What changed with the migration from Next.** In Next, this route
 * called `revalidatePath` and discarded the static ISR page. In TanStack
 * Start there is no origin-side page cache: `/blog`, `/blog/<slug>`, and
 * `/sitemap.xml` build every request directly from Postgres. So
 * "revalidation" at the origin is **moot**, and the only remaining
 * staleness is the 60-second edge cache window (`s-maxage=60` in
 * `lib/seo/cache-headers.ts`), which expires on its own. What the route is
 * still worth keeping for is the outward ping: it is the one place that
 * knows a post just went live, so IndexNow is submitted from here — and that
 * submission must never be able to fail the response (hard rule 5), which is
 * why `submitToIndexNow` swallows everything and only reports an outcome.
 */
import "@tanstack/react-start/server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { NO_STORE } from "../seo/cache-headers";
import { submitToIndexNow } from "./indexnow";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function secretEquals(a: string, b: string): boolean {
  const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
    },
  });
}

export async function revalidateBlogResponse(request: Request): Promise<Response> {
  const token = process.env["TABLO_REVALIDATE_TOKEN"];
  const authorization = request.headers.get("authorization") ?? "";
  if (
    token === undefined ||
    token === "" ||
    !secretEquals(authorization, `Bearer ${token}`)
  ) {
    return json({ revalidated: false }, 401);
  }

  let slug: string | null = null;
  try {
    const body = (await request.json()) as { slug?: unknown };
    if (typeof body.slug === "string") {
      if (!SLUG_PATTERN.test(body.slug)) {
        return json({ revalidated: false, error: "bad slug" }, 400);
      }
      slug = body.slug;
    }
  } catch {
    // An empty or non-JSON body is allowed — meaning "just the list and sitemap."
  }

  const paths = [
    "/blog",
    ...(slug === null ? [] : [`/blog/${slug}`]),
    "/sitemap.xml",
  ];
  const indexnow = await submitToIndexNow(paths);
  return json(
    {
      revalidated: true,
      slug,
      paths,
      origin_cache: "none",
      edge_max_age_seconds: 60,
      indexnow,
    },
    200,
  );
}

export function revalidateBlogMethodNotAllowed(): Response {
  return json({ revalidated: false, error: "method not allowed" }, 405);
}
