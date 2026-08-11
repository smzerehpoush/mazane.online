/**
 * مرز وب — ورود/خروج پنل مدیریت (بلیت ۲۰): env تزریق‌شده ⟸ پاسخ endpoint.
 *
 * همان مرز `post-view.ts`: منطق در `lib/server/admin-login.ts` و
 * `admin-logout.ts` مستقیم از تست صدا زده می‌شود، بدون بالا آوردن سرور.
 *
 * سنجیده می‌شود:
 *   ۱. رمز درست/غلط رفتار درست دارد.
 *   ۲. کوکی نشست هر سه پرچم `HttpOnly`/`Secure`/`SameSite=Strict` را دارد.
 *   ۳. چند تلاش ناموفق پیاپی قفل موقت می‌شود (۴۲۹).
 *   ۴. خروج کوکی را با `Max-Age=0` باطل می‌کند.
 *   ۵. همه‌ی پاسخ‌ها `Cache-Control: no-store` و `X-Robots-Tag: noindex, nofollow` دارند.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword, MAX_LOGIN_ATTEMPTS, SESSION_TTL_MS } from "../src/lib/admin-auth";
import { adminLoginMethodNotAllowed, adminLoginResponse } from "../src/lib/server/admin-login";
import { adminLogoutMethodNotAllowed, adminLogoutResponse } from "../src/lib/server/admin-logout";
import {
  ADMIN_SESSION_COOKIE,
  buildSessionCookie,
  hasValidSession,
  resetLoginAttempts,
} from "../src/lib/server/admin-session";

/** استخراج مقدار خام کوکی از رشته‌ی هدر `Set-Cookie` — فقط برای تست. */
function cookieValue(setCookieHeader: string): string {
  const match = setCookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]*)`));
  if (match?.[1] === undefined) throw new Error("کوکی نشست در هدر نیست");
  return match[1];
}

const PASSWORD = "correct-horse-battery-staple";
const SECRET = "test-session-secret";

function loginRequest(body: unknown): Request {
  return new Request("https://tablo.gold/api/admin-login", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("TABLO_ADMIN_PASSWORD_HASH", hashPassword(PASSWORD));
  vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
  resetLoginAttempts();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetLoginAttempts();
});

describe("POST /api/admin-login", () => {
  it("رمز درست ⟸ ۲۰۴ با کوکی نشست امن", async () => {
    const response = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(204);

    const cookie = response.headers.get("set-cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain("tablo_admin_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
  });

  it("رمز غلط ⟸ ۴۰۱ بدون کوکی", async () => {
    const response = await adminLoginResponse(loginRequest({ password: "wrong" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("بدنه‌ی نامعتبر و رمز غایب ⟸ ۴۰۰", async () => {
    expect((await adminLoginResponse(loginRequest("{ نه JSON"))).status).toBe(400);
    expect((await adminLoginResponse(loginRequest({}))).status).toBe(400);
    expect((await adminLoginResponse(loginRequest({ password: "" }))).status).toBe(400);
  });

  it("بدنه‌ی غول‌آسا ⟸ ۴۰۰ بدون parse", async () => {
    const response = await adminLoginResponse(loginRequest({ password: "x".repeat(2000) }));
    expect(response.status).toBe(400);
  });

  it("متد دیگر ⟸ ۴۰۵ با هدر Allow", async () => {
    const response = adminLoginMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it(`بعد از ${MAX_LOGIN_ATTEMPTS} تلاش ناموفق پیاپی ⟸ ۴۲۹، حتی با رمز درست`, async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      const response = await adminLoginResponse(loginRequest({ password: "wrong" }));
      expect(response.status).toBe(401);
    }
    const locked = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(locked.status).toBe(429);
    expect(locked.headers.get("set-cookie")).toBeNull();
  });

  it("ورود موفق شمارنده‌ی تلاش‌های ناموفق را پاک می‌کند", async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      await adminLoginResponse(loginRequest({ password: "wrong" }));
    }
    const success = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(success.status).toBe(204);

    // بعد از موفقیت، شمارنده صفر است — یک تلاش ناموفق تازه نباید فوراً قفل کند.
    const afterSuccess = await adminLoginResponse(loginRequest({ password: "wrong" }));
    expect(afterSuccess.status).toBe(401);
  });

  it("هش رمز تنظیم‌نشده ⟸ همیشه ۴۰۱ (fail closed)", async () => {
    vi.stubEnv("TABLO_ADMIN_PASSWORD_HASH", "");
    const response = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(401);
  });

  it("همه‌ی پاسخ‌ها بی‌کش و بدون اجازه‌ی نمایه‌سازی‌اند", async () => {
    for (const response of [
      await adminLoginResponse(loginRequest({ password: PASSWORD })),
      await adminLoginResponse(loginRequest({ password: "wrong" })),
      await adminLoginResponse(loginRequest({})),
      adminLoginMethodNotAllowed(),
    ]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });
});

describe("POST /api/admin-logout", () => {
  it("کوکی نشست را با Max-Age=0 باطل می‌کند", () => {
    const response = adminLogoutResponse();
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("tablo_admin_session=;");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("بدون هیچ نشست فعالی هم موفق است", () => {
    // هیچ کوکی‌ای فرستاده نشده — منطق شرط ندارد، همیشه باطل می‌کند.
    const response = adminLogoutResponse();
    expect(response.status).toBe(204);
  });

  it("متد دیگر ⟸ ۴۰۵ با هدر Allow", () => {
    const response = adminLogoutMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("بی‌کش و بدون اجازه‌ی نمایه‌سازی است", () => {
    const response = adminLogoutResponse();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("hasValidSession — بررسی نشست از هدر خام Cookie", () => {
  it("بدون هدر Cookie ⟸ نامعتبر", () => {
    expect(hasValidSession(null)).toBe(false);
  });

  it("کوکی معتبرِ تازه‌صادرشده ⟸ معتبر", () => {
    const cookie = buildSessionCookie(1000);
    expect(cookie).not.toBeNull();
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    expect(hasValidSession(header, 1000)).toBe(true);
  });

  it("کنار کوکی‌های دیگر هم پیدا می‌شود", () => {
    const cookie = buildSessionCookie(1000);
    const header = `foo=bar; ${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}; baz=qux`;
    expect(hasValidSession(header, 1000)).toBe(true);
  });

  it("بعد از انقضای TTL نامعتبر می‌شود", () => {
    const cookie = buildSessionCookie(0);
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    expect(hasValidSession(header, SESSION_TTL_MS + 1)).toBe(false);
  });

  it("نام کوکی غلط ⟸ نامعتبر", () => {
    expect(hasValidSession("some_other_cookie=abc")).toBe(false);
  });

  it("TABLO_ADMIN_SESSION_SECRET تنظیم‌نشده ⟸ همیشه نامعتبر (fail closed)", () => {
    const cookie = buildSessionCookie(1000);
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", "");
    expect(hasValidSession(header, 1000)).toBe(false);
  });
});
