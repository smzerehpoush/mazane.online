import "@tanstack/react-start/server-only";

import { ADMIN_NO_INDEX_HEADERS } from "../seo/admin-headers";

export { ADMIN_NO_INDEX_HEADERS };

export function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ADMIN_NO_INDEX_HEADERS,
      ...extra,
    },
  });
}

export function unauthorized(): Response {
  return json({ error: "نشست معتبر نیست" }, 401);
}

export function notFound(): Response {
  return json({ error: "پست پیدا نشد" }, 404);
}
