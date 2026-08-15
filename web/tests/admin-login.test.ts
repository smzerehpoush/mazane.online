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

function cookieValue(setCookieHeader: string): string {
  const match = setCookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]*)`));
  if (match?.[1] === undefined) throw new Error("session cookie missing from header");
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
  it("correct password ⟸ 204 with secure session cookie", async () => {
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

  it("wrong password ⟸ 401 without cookie", async () => {
    const response = await adminLoginResponse(loginRequest({ password: "wrong" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("invalid body and missing password ⟸ 400", async () => {
    expect((await adminLoginResponse(loginRequest("{ نه JSON"))).status).toBe(400);
    expect((await adminLoginResponse(loginRequest({}))).status).toBe(400);
    expect((await adminLoginResponse(loginRequest({ password: "" }))).status).toBe(400);
  });

  it("oversized body ⟸ 400 without parsing", async () => {
    const response = await adminLoginResponse(loginRequest({ password: "x".repeat(2000) }));
    expect(response.status).toBe(400);
  });

  it("other method ⟸ 405 with Allow header", async () => {
    const response = adminLoginMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it(`after ${MAX_LOGIN_ATTEMPTS} consecutive failed attempts ⟸ 429, even with the correct password`, async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      const response = await adminLoginResponse(loginRequest({ password: "wrong" }));
      expect(response.status).toBe(401);
    }
    const locked = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(locked.status).toBe(429);
    expect(locked.headers.get("set-cookie")).toBeNull();
  });

  it("a successful login clears the failed-attempt counter", async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      await adminLoginResponse(loginRequest({ password: "wrong" }));
    }
    const success = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(success.status).toBe(204);

    const afterSuccess = await adminLoginResponse(loginRequest({ password: "wrong" }));
    expect(afterSuccess.status).toBe(401);
  });

  it("unset password hash ⟸ always 401 (fail closed)", async () => {
    vi.stubEnv("TABLO_ADMIN_PASSWORD_HASH", "");
    const response = await adminLoginResponse(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(401);
  });

  it("all responses are uncached and non-indexable", async () => {
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
  it("invalidates the session cookie with Max-Age=0", () => {
    const response = adminLogoutResponse();
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("tablo_admin_session=;");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("succeeds even without any active session", () => {
    const response = adminLogoutResponse();
    expect(response.status).toBe(204);
  });

  it("other method ⟸ 405 with Allow header", () => {
    const response = adminLogoutMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("is uncached and non-indexable", () => {
    const response = adminLogoutResponse();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("hasValidSession — checking the session from the raw Cookie header", () => {
  it("without a Cookie header ⟸ invalid", () => {
    expect(hasValidSession(null)).toBe(false);
  });

  it("a freshly issued valid cookie ⟸ valid", () => {
    const cookie = buildSessionCookie(1000);
    expect(cookie).not.toBeNull();
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    expect(hasValidSession(header, 1000)).toBe(true);
  });

  it("is found alongside other cookies", () => {
    const cookie = buildSessionCookie(1000);
    const header = `foo=bar; ${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}; baz=qux`;
    expect(hasValidSession(header, 1000)).toBe(true);
  });

  it("becomes invalid after the TTL expires", () => {
    const cookie = buildSessionCookie(0);
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    expect(hasValidSession(header, SESSION_TTL_MS + 1)).toBe(false);
  });

  it("wrong cookie name ⟸ invalid", () => {
    expect(hasValidSession("some_other_cookie=abc")).toBe(false);
  });

  it("TABLO_ADMIN_SESSION_SECRET unset ⟸ always invalid (fail closed)", () => {
    const cookie = buildSessionCookie(1000);
    const header = `${ADMIN_SESSION_COOKIE}=${cookieValue(cookie as string)}`;
    vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", "");
    expect(hasValidSession(header, 1000)).toBe(false);
  });
});
