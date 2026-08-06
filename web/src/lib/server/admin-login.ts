/**
 * منطق ‎POST /api/admin-login‎ — ورود به پنل مدیریت (بلیت ۲۰).
 *
 * جدا از مسیر، تا مرز تست وب بتواند رفتار را با env تزریق‌شده بسنجد — همان
 * الگوی `post-view.ts`.
 *
 * قرارداد:
 *     POST /api/admin-login    {"password": "<رمز>"}
 *     ← 204 بدون بدنه            رمز درست؛ Set-Cookie نشست
 *     ← 400                      بدنه‌ی نامعتبر یا رمز غایب
 *     ← 401                      رمز غلط
 *     ← 429                      قفل موقت — تلاش‌های ناموفق پیاپی
 *     ← 405                      متد دیگر
 *
 * چرا قفل پیش از parse بدنه بررسی می‌شود: در حالت قفل، حتی parse کردن یک
 * بدنه‌ی حمله‌ای بی‌فایده است — رد سریع.
 *
 * ‎Cache-Control: no-store‎ و ‎X-Robots-Tag: noindex, nofollow‎ روی **همه‌ی**
 * پاسخ‌ها الزامی است (بند ۹ قراردادها) — این مسیر پاسخش کاملاً دست خودش
 * است، پس مستقیم می‌گذارد، نه فقط با اتکا به میان‌افزار سراسری.
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import {
  buildSessionCookie,
  isLoginLocked,
  registerFailedLogin,
  registerSuccessfulLogin,
  verifyAdminPassword,
} from "./admin-session";

/** بدنه‌ی معتبر چند ده بایت است؛ بقیه‌اش سوءاستفاده است. */
const MAX_BODY_BYTES = 1024;

const ADMIN_NO_INDEX_HEADERS = {
  "Cache-Control": NO_STORE,
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ADMIN_NO_INDEX_HEADERS,
      ...extra,
    },
  });
}

export async function adminLoginResponse(request: Request): Promise<Response> {
  if (isLoginLocked()) {
    return json({ error: "تلاش‌های ناموفق پیاپی — چند دقیقه دیگر دوباره امتحان کنید" }, 429);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "بدنه بیش از حد بزرگ است" }, 400);

  let password: unknown;
  try {
    const body: unknown = JSON.parse(raw);
    password =
      typeof body === "object" && body !== null
        ? (body as { password?: unknown }).password
        : undefined;
  } catch {
    return json({ error: "بدنه JSON معتبر نیست" }, 400);
  }

  if (typeof password !== "string" || password.length === 0) {
    return json({ error: "رمز عبور لازم است" }, 400);
  }

  if (!verifyAdminPassword(password)) {
    registerFailedLogin();
    return json({ error: "رمز عبور اشتباه است" }, 401);
  }

  registerSuccessfulLogin();
  const cookie = buildSessionCookie();
  if (cookie === null) {
    // پیکربندی ناقص سرور (MAZANE_ADMIN_SESSION_SECRET نیست) — نه خطای کاربر.
    console.error("admin-login: MAZANE_ADMIN_SESSION_SECRET تنظیم نشده");
    return json({ error: "پیکربندی سرور ناقص است" }, 500);
  }

  return new Response(null, {
    status: 204,
    headers: { ...ADMIN_NO_INDEX_HEADERS, "Set-Cookie": cookie },
  });
}

export function adminLoginMethodNotAllowed(): Response {
  return json({ error: "فقط POST" }, 405, { Allow: "POST" });
}
