import "@tanstack/react-start/server-only";

import { ADMIN_NO_INDEX_HEADERS, json } from "./admin-http";
import {
  buildSessionCookie,
  isLoginLocked,
  registerFailedLogin,
  registerSuccessfulLogin,
  verifyAdminPassword,
} from "./admin-session";

const MAX_BODY_BYTES = 1024;

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
    console.error("admin-login: TABLO_ADMIN_SESSION_SECRET تنظیم نشده");
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
