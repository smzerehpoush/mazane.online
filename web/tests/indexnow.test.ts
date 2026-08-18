import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INDEXNOW_ENDPOINT,
  buildIndexNowPayload,
  isSubmittablePath,
} from "../src/lib/seo/indexnow";
import { submitToIndexNow } from "../src/lib/server/indexnow";
import { revalidateBlogResponse } from "../src/lib/server/revalidate-blog";
import { SITE_URL } from "../src/lib/site";

const KEY = "0123456789abcdef0123456789abcdef";
const PATHS = ["/blog", "/blog/maliyat-tala-1405", "/sitemap.xml"];

function ok(): Response {
  return new Response("", { status: 200 });
}

describe("IndexNow payload", () => {
  it("no key ⟹ nothing to submit (the mechanism is a no-op, not a crash)", () => {
    expect(buildIndexNowPayload(PATHS, { key: undefined })).toBeNull();
    expect(buildIndexNowPayload(PATHS, { key: "" })).toBeNull();
    expect(buildIndexNowPayload(PATHS, { key: "   " })).toBeNull();
  });

  it("a malformed key is treated as absent — junk is never sent to the endpoint", () => {
    expect(buildIndexNowPayload(PATHS, { key: "short" })).toBeNull();
    expect(buildIndexNowPayload(PATHS, { key: "has space here" })).toBeNull();
    expect(buildIndexNowPayload(PATHS, { key: `${"a".repeat(129)}` })).toBeNull();
  });

  it("host, key, and keyLocation come from the site URL", () => {
    const payload = buildIndexNowPayload(PATHS, { key: KEY });
    expect(payload?.host).toBe("tablo.gold");
    expect(payload?.key).toBe(KEY);
    expect(payload?.keyLocation).toBe(`${SITE_URL}/${KEY}.txt`);
  });

  it("only content URLs are submitted — the sitemap, /go/, /admin and /api/ are not pages", () => {
    const payload = buildIndexNowPayload(
      [...PATHS, "/go/milli", "/admin/posts", "/api/prices", "/robots.txt"],
      { key: KEY },
    );
    expect(payload?.urlList).toEqual([`${SITE_URL}/blog`, `${SITE_URL}/blog/maliyat-tala-1405`]);
    expect(isSubmittablePath("/sitemap.xml")).toBe(false);
    expect(isSubmittablePath("/tala-18")).toBe(true);
    expect(isSubmittablePath("tala-18")).toBe(false);
  });

  it("duplicate paths are collapsed", () => {
    const payload = buildIndexNowPayload(["/blog", "/blog"], { key: KEY });
    expect(payload?.urlList).toEqual([`${SITE_URL}/blog`]);
  });

  it("a key with nothing submittable left is still a no-op", () => {
    expect(buildIndexNowPayload(["/sitemap.xml"], { key: KEY })).toBeNull();
  });
});

describe("submitToIndexNow", () => {
  it("no key configured ⟹ skipped, and no request is made", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await submitToIndexNow(PATHS, { key: undefined, fetchImpl })).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("with a key ⟹ one POST of JSON to the IndexNow endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ok());
    expect(await submitToIndexNow(PATHS, { key: KEY, fetchImpl })).toBe("submitted");

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      host: "tablo.gold",
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList: [`${SITE_URL}/blog`, `${SITE_URL}/blog/maliyat-tala-1405`],
    });
  });

  it("the endpoint refusing is reported, never thrown — publishing is unaffected", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 403 }));
    expect(await submitToIndexNow(PATHS, { key: KEY, fetchImpl })).toBe("failed");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("the network being down is reported, never thrown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("ENOTFOUND"));
    expect(await submitToIndexNow(PATHS, { key: KEY, fetchImpl })).toBe("failed");
    error.mockRestore();
  });

  it("the key comes from TABLO_INDEXNOW_KEY when it isn't passed in", async () => {
    vi.stubEnv("TABLO_INDEXNOW_KEY", KEY);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ok());
    expect(await submitToIndexNow(PATHS, { fetchImpl })).toBe("submitted");
    vi.unstubAllEnvs();
  });
});

describe("POST /api/revalidate-blog pings IndexNow", () => {
  const TOKEN = "test-token";

  beforeEach(() => {
    vi.stubEnv("TABLO_REVALIDATE_TOKEN", TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function publish(): Promise<{ status: number; payload: { indexnow?: string } }> {
    const response = await revalidateBlogResponse(
      new Request("http://localhost/api/revalidate-blog", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ slug: "maliyat-tala-1405" }),
      }),
    );
    return { status: response.status, payload: (await response.json()) as { indexnow?: string } };
  }

  it("without a key the post still publishes and the ping is honestly reported as skipped", async () => {
    vi.stubEnv("TABLO_INDEXNOW_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { status, payload } = await publish();
    expect(status).toBe(200);
    expect(payload.indexnow).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("with a key the post page and the listing are submitted", async () => {
    vi.stubEnv("TABLO_INDEXNOW_KEY", KEY);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    const { status, payload } = await publish();
    expect(status).toBe(200);
    expect(payload.indexnow).toBe("submitted");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as { urlList: string[] };
    expect(body.urlList).toEqual([`${SITE_URL}/blog`, `${SITE_URL}/blog/maliyat-tala-1405`]);
  });

  it("IndexNow being down never turns publishing into an error", async () => {
    vi.stubEnv("TABLO_INDEXNOW_KEY", KEY);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect ETIMEDOUT"));
    const { status, payload } = await publish();
    expect(status).toBe(200);
    expect(payload.indexnow).toBe("failed");
  });
});
