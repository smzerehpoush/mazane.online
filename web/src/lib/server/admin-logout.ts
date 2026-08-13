import "@tanstack/react-start/server-only";

import { ADMIN_NO_INDEX_HEADERS } from "./admin-http";
import { buildLogoutCookie } from "./admin-session";

export function adminLogoutResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...ADMIN_NO_INDEX_HEADERS, "Set-Cookie": buildLogoutCookie() },
  });
}

export function adminLogoutMethodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "فقط POST" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ADMIN_NO_INDEX_HEADERS,
      Allow: "POST",
    },
  });
}
