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

export const ADMIN_SESSION_COOKIE = "tablo_admin_session";

const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

const attemptsByKey = new Map<string, AttemptState>();
const RATE_LIMIT_KEY = "login";

function currentAttemptState(): AttemptState {
  return attemptsByKey.get(RATE_LIMIT_KEY) ?? INITIAL_ATTEMPT_STATE;
}

export function isLoginLocked(nowMs: number = Date.now()): boolean {
  return isLockedOut(currentAttemptState(), nowMs);
}

export function registerFailedLogin(nowMs: number = Date.now()): void {
  attemptsByKey.set(RATE_LIMIT_KEY, recordFailedAttempt(currentAttemptState(), nowMs));
}

export function registerSuccessfulLogin(): void {
  attemptsByKey.set(RATE_LIMIT_KEY, recordSuccessfulAttempt());
}

export function resetLoginAttempts(): void {
  attemptsByKey.clear();
}

function envOrNull(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === "" ? null : value;
}

export function verifyAdminPassword(password: string): boolean {
  const hash = envOrNull("TABLO_ADMIN_PASSWORD_HASH");
  if (hash === null) return false;
  return verifyPassword(password, hash);
}

export function buildSessionCookie(nowMs: number = Date.now()): string | null {
  const secret = envOrNull("TABLO_ADMIN_SESSION_SECRET");
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

export function hasValidSession(cookieHeader: string | null, nowMs: number = Date.now()): boolean {
  const secret = envOrNull("TABLO_ADMIN_SESSION_SECRET");
  if (secret === null) return false;
  const token = readCookie(cookieHeader, ADMIN_SESSION_COOKIE);
  if (token === null) return false;
  return verifySessionToken(secret, token, nowMs, SESSION_TTL_MS);
}
