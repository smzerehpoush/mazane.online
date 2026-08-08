/**
 * منطق خالص احراز هویت پنل (`lib/admin-auth.ts`) — هش/تأیید رمز، امضا/اعتبار
 * نشست، و تصمیم قفل‌شدن موقت. بدون env، بدون کوکی، بدون Request — همه‌چیز
 * پارامتر صریح است (شرح کامل در `admin-auth.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  hashPassword,
  INITIAL_ATTEMPT_STATE,
  isLockedOut,
  LOCKOUT_MS,
  MAX_LOGIN_ATTEMPTS,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  SESSION_TTL_MS,
  verifyPassword,
  verifySessionToken,
  type AttemptState,
} from "../src/lib/admin-auth";

describe("hashPassword / verifyPassword", () => {
  it("رمز درست را تأیید می‌کند", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("رمز غلط رد می‌شود", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("رشته‌ی فارسی هم درست کار می‌کند", () => {
    const hash = hashPassword("رمز-عبور-۱۲۳۴");
    expect(verifyPassword("رمز-عبور-۱۲۳۴", hash)).toBe(true);
    expect(verifyPassword("رمز-عبور-۱۲۳۵", hash)).toBe(false);
  });

  it("دو هش از یک رمز یکسان نیستند (salt تصادفی) ولی هر دو تأیید می‌شوند", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("هش بدشکل ⟸ false، نه استثنا", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "salthex:")).toBe(false);
    expect(verifyPassword("x", ":hashhex")).toBe(false);
    // طول hash کوتاه‌تر از SCRYPT_KEYLEN — نباید timingSafeEqual را با طول
    // نابرابر صدا بزند و استثنا بگیرد.
    expect(verifyPassword("x", "aabbcc:aabbcc")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  const SECRET = "test-session-secret";

  it("نشان تازه‌صادرشده معتبر است", () => {
    const token = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(SECRET, token, 1000)).toBe(true);
  });

  it("در بازه‌ی TTL همچنان معتبر است", () => {
    const token = createSessionToken(SECRET, 0);
    expect(verifySessionToken(SECRET, token, SESSION_TTL_MS, SESSION_TTL_MS)).toBe(true);
  });

  it("بعد از انقضای TTL نامعتبر می‌شود", () => {
    const token = createSessionToken(SECRET, 0);
    expect(verifySessionToken(SECRET, token, SESSION_TTL_MS + 1, SESSION_TTL_MS)).toBe(false);
  });

  it("با کلید غلط نامعتبر است", () => {
    const token = createSessionToken(SECRET, 1000);
    expect(verifySessionToken("wrong-secret", token, 1000)).toBe(false);
  });

  it("نشان دستکاری‌شده (امضای عوض‌شده) نامعتبر است", () => {
    const token = createSessionToken(SECRET, 1000);
    const [issuedAt] = token.split(".");
    const tampered = `${issuedAt}.${"0".repeat(64)}`;
    expect(verifySessionToken(SECRET, tampered, 1000)).toBe(false);
  });

  it("زمان صدور در آینده (دستکاری) نامعتبر است", () => {
    const token = createSessionToken(SECRET, 5000);
    expect(verifySessionToken(SECRET, token, 1000)).toBe(false);
  });

  it("نشان بدشکل ⟸ false، نه استثنا", () => {
    expect(verifySessionToken(SECRET, "not-a-token", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "abc.def", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "12x.aabbcc", 1000)).toBe(false);
  });
});

describe("قفل‌شدن موقت پس از تلاش‌های ناموفق", () => {
  it("قبل از رسیدن به سقف قفل نیست", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      state = recordFailedAttempt(state, 0);
      expect(isLockedOut(state, 0)).toBe(false);
    }
  });

  it(`دقیقاً پس از ${MAX_LOGIN_ATTEMPTS} تلاش ناموفق پیاپی قفل می‌شود`, () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      state = recordFailedAttempt(state, 0);
    }
    expect(isLockedOut(state, 0)).toBe(true);
  });

  it("در بازه‌ی قفل، قفل باقی می‌ماند", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    expect(isLockedOut(state, LOCKOUT_MS - 1)).toBe(true);
  });

  it("بعد از پایان بازه‌ی قفل، دیگر قفل نیست", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    expect(isLockedOut(state, LOCKOUT_MS)).toBe(false);
  });

  it("بعد از انقضای قفل، شمارش تلاش‌های بعدی از نو شروع می‌شود", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    // یک تلاش تازه بعد از پایان قفل — نباید بلافاصله دوباره قفل کند.
    state = recordFailedAttempt(state, LOCKOUT_MS);
    expect(state.failures).toBe(1);
    expect(isLockedOut(state, LOCKOUT_MS)).toBe(false);
  });

  it("ورود موفق شمارنده را کاملاً پاک می‌کند", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) state = recordFailedAttempt(state, 0);
    state = recordSuccessfulAttempt();
    expect(state).toEqual(INITIAL_ATTEMPT_STATE);
    expect(isLockedOut(state, 0)).toBe(false);
  });
});
