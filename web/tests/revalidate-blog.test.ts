/**
 * مرز وب — قلاب انتشار بلاگ (مصرف‌کننده‌ی آینده: صف انتشار محتوا).
 *
 * ⚠️ رفتار با مهاجرت از نکست عوض شد و تست هم همان را می‌سنجد: دیگر
 * `revalidatePath` نکست در کار نیست (کش صفحه‌ای در مبدأ وجود ندارد). آنچه
 * باقی مانده و **باید** درست بماند، همان دروازه است: احراز توکن با مقایسه‌ی
 * زمان‌ثابت، اعتبارسنجی اسلاگ، و اعلام صریح مسیرهایی که تازه ساخته می‌شوند.
 * شرح کامل در `src/lib/server/revalidate-blog.ts`.
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
  it("بدون توکن ⟸ ۴۰۱", async () => {
    const { status, payload } = await post({ body: { slug: "x" } });
    expect(status).toBe(401);
    expect(payload.revalidated).toBe(false);
  });

  it("توکن غلط ⟸ ۴۰۱", async () => {
    const { status } = await post({ token: "ghalat", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("توکن غلط با طول متفاوت هم ۴۰۱ می‌دهد، نه استثنا (مقایسه‌ی زمان‌ثابت)", async () => {
    const { status } = await post({ token: "k", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("توکن تنظیم‌نشده در سرور ⟸ ۴۰۱ حتی با هدر خالی (fail closed)", async () => {
    vi.stubEnv("TABLO_REVALIDATE_TOKEN", "");
    const { status } = await post({ token: "", body: { slug: "x" } });
    expect(status).toBe(401);
  });

  it("انتشار/ویرایش پست ⟸ فهرست، صفحه‌ی پست و سایت‌مپ اعلام می‌شوند", async () => {
    const { status, payload } = await post({
      token: TOKEN,
      body: { slug: "moghayese-karmozd-sakooha" },
    });
    expect(status).toBe(200);
    expect(payload.revalidated).toBe(true);
    expect(payload.paths).toEqual(["/blog", "/blog/moghayese-karmozd-sakooha", "/sitemap.xml"]);
  });

  it("بدون اسلاگ (مثلاً پس‌گیری انبوه) فقط فهرست و سایت‌مپ اعلام می‌شوند", async () => {
    const { status, payload } = await post({ token: TOKEN, body: {} });
    expect(status).toBe(200);
    expect(payload.slug).toBeNull();
    expect(payload.paths).toEqual(["/blog", "/sitemap.xml"]);
  });

  it("اسلاگ بدشکل ⟸ ۴۰۰", async () => {
    const { status, payload } = await post({
      token: TOKEN,
      body: { slug: "../../etc/passwd" },
    });
    expect(status).toBe(400);
    expect(payload.revalidated).toBe(false);
  });

  it("صادقانه اعلام می‌کند که کش صفحه‌ای در مبدأ وجود ندارد", async () => {
    const { payload } = await post({ token: TOKEN, body: {} });
    expect(payload.origin_cache).toBe("none");
  });
});
