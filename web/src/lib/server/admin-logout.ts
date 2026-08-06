/**
 * منطق ‎POST /api/admin-logout‎ — خروج از پنل مدیریت (بلیت ۲۰).
 *
 * بدون شرط کوکی را باطل می‌کند — حتی اگر نشستی در کار نبود، پاسخ همچنان
 * موفق است (خروج از یک نشست غایب هم «خارج شدن» است، نه خطا).
 *
 * قرارداد:
 *     POST /api/admin-logout
 *     ← 204 بدون بدنه            Set-Cookie با Max-Age=0 — نشست باطل شد
 *     ← 405                      متد دیگر
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { buildLogoutCookie } from "./admin-session";

const ADMIN_NO_INDEX_HEADERS = {
  "Cache-Control": NO_STORE,
  "X-Robots-Tag": "noindex, nofollow",
} as const;

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
