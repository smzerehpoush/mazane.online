// ⚠️ هیچ کامپوننت کلاینتی نباید این فایل را import کند — `node:crypto` و کلید
// نشست نباید به باندل مرورگر برسند.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

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

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(secret: string, issuedAtMs: number): string {
  return createHmac("sha256", secret).update(String(issuedAtMs)).digest("hex");
}

export function createSessionToken(secret: string, issuedAtMs: number): string {
  return `${issuedAtMs}.${sign(secret, issuedAtMs)}`;
}

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
  if (ageMs < 0) return false;
  return ageMs <= ttlMs;
}

export interface AttemptState {
  readonly failures: number;
  readonly lockedUntilMs: number | null;
}

export const INITIAL_ATTEMPT_STATE: AttemptState = { failures: 0, lockedUntilMs: null };

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function isLockedOut(state: AttemptState, nowMs: number): boolean {
  return state.lockedUntilMs !== null && nowMs < state.lockedUntilMs;
}

export function recordFailedAttempt(state: AttemptState, nowMs: number): AttemptState {
  const lockExpired = state.lockedUntilMs !== null && nowMs >= state.lockedUntilMs;
  const failures = (lockExpired ? 0 : state.failures) + 1;
  const lockedUntilMs = failures >= MAX_LOGIN_ATTEMPTS ? nowMs + LOCKOUT_MS : null;
  return { failures, lockedUntilMs };
}

export function recordSuccessfulAttempt(): AttemptState {
  return INITIAL_ATTEMPT_STATE;
}
