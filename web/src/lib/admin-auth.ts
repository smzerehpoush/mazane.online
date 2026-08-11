/**
 * منطق خالص احراز هویت پنل مدیریت (بلیت ۲۰) — بدون خواندن `process.env`،
 * بدون کوکی، بدون Request/Response. فقط سه الگوریتم و یک تصمیم:
 *
 *   ۱. هش/تأیید رمز عبور (`scrypt` — Node built-in، بدون وابستگی تازه).
 *   ۲. امضا/اعتبارسنجی نشان نشست (HMAC روی زمان صدور، بدون جدول/دیتابیس).
 *   ۳. تصمیم قفل‌شدن موقت پس از تلاش‌های ناموفق پیاپی.
 *
 * چرا این فایل جدا از `server/admin-session.ts` است: همان دلیل
 * `lib/views.ts` در برابر `server/view-counter.ts` — پارامترهای حساس
 * (هش رمز، کلید HMAC، زمان جاری) همه صریح پاس داده می‌شوند، پس این ماژول در
 * تست بدون هیچ env و بدون context درخواست فراخوانی می‌شود. `server/*.ts`
 * مسئول خواندن `process.env` و پیوند این تصمیم‌ها به کوکی/Request واقعی است.
 *
 * ⚠️ برخلاف `lib/views.ts`، این فایل عمداً `node:crypto` را مستقیم import
 * می‌کند — یک built-in Node است نه `pg`/`ioredis`، و هرگز به باندل مرورگر
 * نمی‌رود چون هیچ کامپوننت کلاینتی این فایل را import نمی‌کند (فقط
 * `server/admin-session.ts` که خودش نشانه‌ی `server-only` دارد).
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** طول خروجی scrypt به بایت — هم زمان هش‌سازی هم زمان تأیید همین است. */
const SCRYPT_KEYLEN = 64;

/**
 * هش رمز عبور برای ذخیره در `TABLO_ADMIN_PASSWORD_HASH`. فرمت:
 * `"<salt هگزادسیمال>:<hash هگزادسیمال>"`. مصرف‌کننده: `scripts/hash-admin-password.mjs`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * تأیید رمز در برابر هش ذخیره‌شده — زمان‌ثابت (قاعده‌ی سخت ۸).
 *
 * پیش از `timingSafeEqual` طول دو بافر را برابر می‌کنیم (بستن کلید روی
 * `SCRYPT_KEYLEN` ثابت)، وگرنه `timingSafeEqual` روی طول نابرابر استثنا
 * می‌دهد — یک هش دستکاری‌شده یا فرمت غلط نباید کل مسیر ورود را بترکاند.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const separator = storedHash.indexOf(":");
  if (separator === -1) return false;

  const saltHex = storedHash.slice(0, separator);
  const hashHex = storedHash.slice(separator + 1);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;

  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

/** عمر نشست — کوکی و امضا هر دو همین را می‌خوانند (۷ روز، بند دسترسی #۳۹). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(secret: string, issuedAtMs: number): string {
  return createHmac("sha256", secret).update(String(issuedAtMs)).digest("hex");
}

/** نشان نشست: `<زمان صدور>.<امضای HMAC>` — بدون جدول، کاملاً stateless. */
export function createSessionToken(secret: string, issuedAtMs: number): string {
  return `${issuedAtMs}.${sign(secret, issuedAtMs)}`;
}

/**
 * اعتبارسنجی نشان نشست: امضا را دوباره می‌سازد، زمان‌ثابت مقایسه می‌کند، و
 * سن را در برابر TTL می‌سنجد. هر بدشکلی، دستکاری یا انقضا ⟸ `false`، نه
 * استثنا — مصرف‌کننده (لایوت `/admin`) فقط یک تصمیم boolean می‌خواهد.
 */
export function verifySessionToken(
  secret: string,
  token: string,
  nowMs: number,
  ttlMs: number = SESSION_TTL_MS,
): boolean {
  const separator = token.indexOf(".");
  if (separator === -1) return false;

  const issuedAtRaw = token.slice(0, separator);
  const signatureHex = token.slice(separator + 1);
  if (!/^\d+$/.test(issuedAtRaw)) return false;
  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAtMs)) return false;

  const expected = Buffer.from(sign(secret, issuedAtMs), "hex");
  const actual = Buffer.from(signatureHex, "hex");
  if (actual.length !== expected.length) return false;
  if (!timingSafeEqual(actual, expected)) return false;

  const ageMs = nowMs - issuedAtMs;
  if (ageMs < 0) return false; // زمان صدور در آینده — دستکاری‌شده
  return ageMs <= ttlMs;
}

/**
 * وضعیت تلاش‌های ورود ناموفق. `lockedUntilMs === null` یعنی قفل نیست.
 * تغییرناپذیر (immutable) — مصرف‌کننده مقدار تازه را جایگزین قبلی می‌کند.
 */
export interface AttemptState {
  readonly failures: number;
  readonly lockedUntilMs: number | null;
}

export const INITIAL_ATTEMPT_STATE: AttemptState = { failures: 0, lockedUntilMs: null };

/** بعد از این‌همه تلاش ناموفق پیاپی، قفل موقت (معیار پذیرش بلیت ۲۰). */
export const MAX_LOGIN_ATTEMPTS = 5;
/** مدت قفل موقت. */
export const LOCKOUT_MS = 15 * 60 * 1000;

/** آیا همین الان قفل است؟ */
export function isLockedOut(state: AttemptState, nowMs: number): boolean {
  return state.lockedUntilMs !== null && nowMs < state.lockedUntilMs;
}

/**
 * ثبت یک تلاش ناموفق. اگر قفل قبلی منقضی شده باشد شمارش از نو شروع می‌شود
 * (وگرنه یک قفل ۱۵ دقیقه‌ای قدیمی تا ابد شمارش را بالا نگه می‌داشت).
 * فراخوان باید پیش از این تابع خودش `isLockedOut` را بسنجد — این تابع در
 * حالت قفل هم صرفاً می‌شمارد، تصمیم رد کردن درخواست را نمی‌گیرد.
 */
export function recordFailedAttempt(state: AttemptState, nowMs: number): AttemptState {
  const lockExpired = state.lockedUntilMs !== null && nowMs >= state.lockedUntilMs;
  const failures = (lockExpired ? 0 : state.failures) + 1;
  const lockedUntilMs = failures >= MAX_LOGIN_ATTEMPTS ? nowMs + LOCKOUT_MS : null;
  return { failures, lockedUntilMs };
}

/** ورود موفق ⟸ شمارنده کاملاً پاک می‌شود. */
export function recordSuccessfulAttempt(): AttemptState {
  return INITIAL_ATTEMPT_STATE;
}
