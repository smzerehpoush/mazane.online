/**
 * ⚠️ Behavior changed with the migration off Next.js, and the test measures
 * that: Next's `revalidatePath` is no longer in play (there's no page cache
 * at the origin). What remains and **must** stay correct is the gate itself:
 * token auth with a constant-time comparison, slug validation, and an
 * explicit announcement of the paths that were just built. Full explanation
 * in `src/lib/server/revalidate-blog.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateBlogResponse } from "../src/lib/server/revalidate-blog";

const TOKEN = "test-token";

interface Payload {
  revalidated: boolean;
  slug?: string | null;
  paths?: string[];
  error?: string;
  origin_cache?: string;
}

function request(opts: { token?: string; body?: unknown }): Request {
  return new Request("http://localhost/api/revalidate-blog", {
    method: "POST",
    headers: {
      ...(opts.token !== undefined ? { authorization: `Bearer ${opts.token}` } : {}),
      "content-type": "application/json",
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

async function post(opts: {
  token?: string;
  body?: unknown;
}): Promise<{ status: number; payload: Payload }> {
  const response = await revalidateBlogResponse(request(opts));
  return { status: response.status, payload: (await response.json()) as Payload };
}

beforeEach(() => {
  vi.stubEnv("TABLO_REVALIDATE_TOKEN", TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/revalidate-blog", () => {
  it("no token ⟸ 401", async () => {
    const { status, payload } = await post({ body: { slug: "x" } });
    expect(status).toBe(401);
    expect(payload.revalidated).toBe(false);
  });

  it("wrong token ⟸ 401", async () => {
    const { status } = await post({ token: "ghalat", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("a wrong token of a different length also gives 401, not an exception (constant-time comparison)", async () => {
    const { status } = await post({ token: "k", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("no token configured on the server ⟸ 401 even with an empty header (fail closed)", async () => {
    vi.stubEnv("TABLO_REVALIDATE_TOKEN", "");
    const { status } = await post({ token: "", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("publishing/editing a post ⟸ the listing, the post page, and the sitemap are announced", async () => {
    const { status, payload } = await post({
      token: TOKEN,
      body: { slug: "moghayese-karmozd-sakooha" },
    });
    expect(status).toBe(200);
    expect(payload.revalidated).toBe(true);
    expect(payload.paths).toEqual(["/blog", "/blog/moghayese-karmozd-sakooha", "/sitemap.xml"]);
  });

  it("no slug (e.g. a bulk retraction) only announces the listing and the sitemap", async () => {
    const { status, payload } = await post({ token: TOKEN, body: {} });
    expect(status).toBe(200);
    expect(payload.slug).toBeNull();
    expect(payload.paths).toEqual(["/blog", "/sitemap.xml"]);
  });

  it("a malformed slug ⟸ 400", async () => {
    const { status, payload } = await post({
      token: TOKEN,
      body: { slug: "../../etc/passwd" },
    });
    expect(status).toBe(400);
    expect(payload.revalidated).toBe(false);
  });

  it("honestly reports that there's no page cache at the origin", async () => {
    const { payload } = await post({ token: TOKEN, body: {} });
    expect(payload.origin_cache).toBe("none");
  });
});
