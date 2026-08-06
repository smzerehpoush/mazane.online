/**
 * مرز وب — endpoint بازتولید بلاگ (بلیت ۱۲؛ مصرف‌کننده‌ی آینده: صف بلیت ۱۳).
 *
 * `next/cache` ماک می‌شود چون revalidatePath فقط داخل رانتایم نکست معنا دارد؛
 * رفتار زیر آزمون: احراز توکن، اعتبار اسلاگ، و اینکه دقیقاً مسیرهای درست
 * (فهرست، پست، سایت‌مپ) revalidate می‌شوند.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";

import { POST } from "../app/api/revalidate-blog/route";

const TOKEN = "test-token";

function request(opts: { token?: string; body?: unknown }): Request {
  return new Request("http://localhost/api/revalidate-blog", {
    method: "POST",
    headers: {
      ...(opts.token !== undefined
        ? { authorization: `Bearer ${opts.token}` }
        : {}),
      "content-type": "application/json",
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv("MAZANE_REVALIDATE_TOKEN", TOKEN);
  vi.mocked(revalidatePath).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/revalidate-blog", () => {
  it("بدون توکن ⟸ ۴۰۱ و هیچ بازتولیدی", async () => {
    const res = await POST(request({ body: { slug: "x" } }));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("توکن غلط ⟸ ۴۰۱", async () => {
    const res = await POST(request({ token: "ghalat", body: { slug: "x" } }));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("توکن تنظیم‌نشده در سرور ⟸ ۴۰۱ حتی با هدر خالی", async () => {
    vi.stubEnv("MAZANE_REVALIDATE_TOKEN", "");
    const res = await POST(request({ token: "", body: { slug: "x" } }));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("انتشار/ویرایش پست ⟸ فهرست، صفحه‌ی پست و سایت‌مپ بازتولید می‌شوند", async () => {
    const res = await POST(
      request({ token: TOKEN, body: { slug: "moghayese-karmozd-sakooha" } }),
    );
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/blog");
    expect(revalidatePath).toHaveBeenCalledWith("/blog/moghayese-karmozd-sakooha");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("بدون اسلاگ (مثلاً پس‌گیری انبوه) فقط فهرست و سایت‌مپ بازتولید می‌شوند", async () => {
    const res = await POST(request({ token: TOKEN, body: {} }));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/blog");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("اسلاگ بدشکل ⟸ ۴۰۰ و هیچ بازتولیدی", async () => {
    const res = await POST(
      request({ token: TOKEN, body: { slug: "../../etc/passwd" } }),
    );
    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
