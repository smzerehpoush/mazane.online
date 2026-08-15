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
  it("verifies the correct password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("works correctly with a Persian string too", () => {
    const hash = hashPassword("رمز-عبور-۱۲۳۴");
    expect(verifyPassword("رمز-عبور-۱۲۳۴", hash)).toBe(true);
    expect(verifyPassword("رمز-عبور-۱۲۳۵", hash)).toBe(false);
  });

  it("two hashes of the same password are not identical (random salt) but both verify", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("a malformed hash returns false, not an exception", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "salthex:")).toBe(false);
    expect(verifyPassword("x", ":hashhex")).toBe(false);
    expect(verifyPassword("x", "aabbcc:aabbcc")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  const SECRET = "test-session-secret";

  it("a freshly issued token is valid", () => {
    const token = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(SECRET, token, 1000)).toBe(true);
  });

  it("remains valid within the TTL window", () => {
    const token = createSessionToken(SECRET, 0);
    expect(verifySessionToken(SECRET, token, SESSION_TTL_MS, SESSION_TTL_MS)).toBe(true);
  });

  it("becomes invalid after the TTL expires", () => {
    const token = createSessionToken(SECRET, 0);
    expect(verifySessionToken(SECRET, token, SESSION_TTL_MS + 1, SESSION_TTL_MS)).toBe(false);
  });

  it("is invalid with the wrong secret", () => {
    const token = createSessionToken(SECRET, 1000);
    expect(verifySessionToken("wrong-secret", token, 1000)).toBe(false);
  });

  it("a tampered token (changed signature) is invalid", () => {
    const token = createSessionToken(SECRET, 1000);
    const [issuedAt] = token.split(".");
    const tampered = `${issuedAt}.${"0".repeat(64)}`;
    expect(verifySessionToken(SECRET, tampered, 1000)).toBe(false);
  });

  it("an issued-at time in the future (tampering) is invalid", () => {
    const token = createSessionToken(SECRET, 5000);
    expect(verifySessionToken(SECRET, token, 1000)).toBe(false);
  });

  it("a malformed token returns false, not an exception", () => {
    expect(verifySessionToken(SECRET, "not-a-token", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "abc.def", 1000)).toBe(false);
    expect(verifySessionToken(SECRET, "12x.aabbcc", 1000)).toBe(false);
  });
});

describe("temporary lockout after failed attempts", () => {
  it("is not locked before reaching the attempt limit", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      state = recordFailedAttempt(state, 0);
      expect(isLockedOut(state, 0)).toBe(false);
    }
  });

  it(`locks exactly after ${MAX_LOGIN_ATTEMPTS} consecutive failed attempts`, () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      state = recordFailedAttempt(state, 0);
    }
    expect(isLockedOut(state, 0)).toBe(true);
  });

  it("stays locked during the lockout window", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    expect(isLockedOut(state, LOCKOUT_MS - 1)).toBe(true);
  });

  it("is no longer locked after the lockout window ends", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    expect(isLockedOut(state, LOCKOUT_MS)).toBe(false);
  });

  it("restarts the attempt count after the lockout expires", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) state = recordFailedAttempt(state, 0);
    state = recordFailedAttempt(state, LOCKOUT_MS);
    expect(state.failures).toBe(1);
    expect(isLockedOut(state, LOCKOUT_MS)).toBe(false);
  });

  it("a successful login fully resets the counter", () => {
    let state: AttemptState = INITIAL_ATTEMPT_STATE;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) state = recordFailedAttempt(state, 0);
    state = recordSuccessfulAttempt();
    expect(state).toEqual(INITIAL_ATTEMPT_STATE);
    expect(isLockedOut(state, 0)).toBe(false);
  });
});
