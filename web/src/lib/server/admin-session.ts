/**
 * نشست پنل مدیریت — تنها جای خواندن `MAZANE_ADMIN_PASSWORD_HASH` و
 * `MAZANE_ADMIN_SESSION_SECRET` واقعی، ساخت هدر `Set-Cookie` واقعی، و
 * نگهداری وضعیت قفل موقت. تصمیم‌های الگوریتمی (هش/امضا/قفل) در
 * `lib/admin-auth.ts` است — این فایل فقط آن‌ها را به env/کوکی واقعی وصل
 * می‌کند (همان تفکیک `views.ts` ⟸ `server/view-counter.ts`).
 *
 * **فقط سمت سرور.** هرگز از هیچ مسیر/کامپوننت کلاینتی مستقیم import نشود —
 * پلاگین import-protection تنکستک با نشانه‌ی زیر بیلد را می‌شکند اگر کسی
 * اشتباه کرد.
 */
import "@tanstack/react-start/server-only";

import {
  createSessionToken,
  INITIAL_ATTEMPT_STATE,
  isLockedOut,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  SESSION_TTL_MS,
  verifyPassword,
  verifySessionToken,
  type AttemptState,
} from "../admin-auth";

/** نام کوکی نشست پنل. */
export const ADMIN_SESSION_COOKIE = "mazane_admin_session";

const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

/**
 * Map ساده در سطح ماژول — یک پردازش Node تنها (سرور یک‌هسته‌ای، بدون
 * ردیس). یک رمز و یک کاربر دارد (تصمیم صریح مالک)، پس قفل سراسری کافی
 * است؛ کلید ثابت فقط برای اجازه دادن به گسترش آینده (مثلاً به‌ازای IP)
 * بدون عوض کردن این امضا.
 */
const attemptsByKey = new Map<string, AttemptState>();
const RATE_LIMIT_KEY = "login";

function currentAttemptState(): AttemptState {
  return attemptsByKey.get(RATE_LIMIT_KEY) ?? INITIAL_ATTEMPT_STATE;
}

/** آیا ورود همین الان به‌خاطر تلاش‌های ناموفق پیاپی قفل است؟ */
export function isLoginLocked(nowMs: number = Date.now()): boolean {
  return isLockedOut(currentAttemptState(), nowMs);
}

/** ثبت یک تلاش ناموفق — فراخوان باید پیش از این خودش `isLoginLocked` را بسنجد. */
export function registerFailedLogin(nowMs: number = Date.now()): void {
  attemptsByKey.set(RATE_LIMIT_KEY, recordFailedAttempt(currentAttemptState(), nowMs));
}

/** ورود موفق ⟸ شمارنده‌ی تلاش‌های ناموفق پاک می‌شود. */
export function registerSuccessfulLogin(): void {
  attemptsByKey.set(RATE_LIMIT_KEY, recordSuccessfulAttempt());
}

/** فقط برای تست — بین تست‌ها Map مشترک را بازنشانی می‌کند. */
export function resetLoginAttempts(): void {
  attemptsByKey.clear();
}

function envOrNull(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === "" ? null : value;
}

/**
 * تأیید رمز در برابر هش env. متغیر تنظیم‌نشده ⟸ همیشه رد (fail closed) —
 * همان قاعده‌ی `revalidate-blog.ts` برای توکن تنظیم‌نشده.
 */
export function verifyAdminPassword(password: string): boolean {
  const hash = envOrNull("MAZANE_ADMIN_PASSWORD_HASH");
  if (hash === null) return false;
  return verifyPassword(password, hash);
}

/**
 * هدر `Set-Cookie` نشست تازه — `null` یعنی `MAZANE_ADMIN_SESSION_SECRET`
 * تنظیم نشده (پیکربندی ناقص سرور، نه خطای کاربر).
 */
export function buildSessionCookie(nowMs: number = Date.now()): string | null {
  const secret = envOrNull("MAZANE_ADMIN_SESSION_SECRET");
  if (secret === null) return null;
  const token = createSessionToken(secret, nowMs);
  return [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

/** هدر `Set-Cookie` خروج — همان کوکی را با انقضای فوری بازمی‌نویسد. */
export function buildLogoutCookie(): string {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

/** مقدار یک کوکی را از هدر خام `Cookie` می‌خواند — `null` یعنی نبود. */
function readCookie(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * آیا هدر `Cookie` خام یک نشست معتبر و منقضی‌نشده دارد؟ ورودی عمداً رشته‌ی
 * خام هدر است نه `Request` — هم از مسیر `server:{handlers}` (با
 * `request.headers.get("cookie")`) و هم از تابع سروری لایوت `/admin`
 * (با `getRequestHeader("cookie")`) یکسان صدا زده می‌شود.
 */
export function hasValidSession(cookieHeader: string | null, nowMs: number = Date.now()): boolean {
  const secret = envOrNull("MAZANE_ADMIN_SESSION_SECRET");
  if (secret === null) return false;
  const token = readCookie(cookieHeader, ADMIN_SESSION_COOKIE);
  if (token === null) return false;
  return verifySessionToken(secret, token, nowMs, SESSION_TTL_MS);
}
