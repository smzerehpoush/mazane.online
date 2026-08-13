import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import type { BlogPost, PublishedPost } from "../src/lib/blog";
import { postViewMethodNotAllowed, postViewResponse } from "../src/lib/server/post-view";
import { byPopularity, hasViewData, type ViewCounts } from "../src/lib/views";
import {
  healthyStore,
  homeData,
  seedBlog,
  seedBrokenViewCounter,
  seedViewCounter,
} from "./support/seed";

function post(slug: string, opts: Partial<BlogPost> = {}): BlogPost {
  return {
    slug,
    title_fa: `عنوان ${slug}`,
    body_md: `متن آزمایشی ${slug} برای سنجش ترتیب کارت‌های انتهای صفحه.`,
    status: "published",
    published_at: opts.published_at ?? "2026-08-01T09:00:00.000Z",
    updated_at: opts.updated_at ?? "2026-08-01T09:00:00.000Z",
    ...opts,
  } as BlogPost;
}

const OLD = post("alef", { published_at: "2026-08-01T09:00:00.000Z" });
const MID = post("be", { published_at: "2026-08-02T09:00:00.000Z" });
const NEW = post("pe", { published_at: "2026-08-03T09:00:00.000Z" });

function request(body: unknown, method = "POST"): Request {
  return new Request("https://tablo.gold/api/post-view", {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/post-view — ثبت بازدید", () => {
  it("پست منتشرشده را می‌شمارد و ۲۰۴ بدون کش می‌دهد", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "pe" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(counter.counts["pe"]).toBe(1);
  });

  it("هر فراخوان یکی اضافه می‌کند", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter({ pe: 7 });

    await postViewResponse(request({ slug: "pe" }));
    await postViewResponse(request({ slug: "pe" }));

    expect(counter.counts["pe"]).toBe(9);
  });

  it("پیش‌نویس و پس‌گرفته شمرده نمی‌شوند — ولی پاسخ همچنان ۲۰۴ است", async () => {
    seedBlog([
      post("draft-one", { status: "draft", published_at: null }),
      post("gone", { status: "retracted" }),
    ]);
    const counter = seedViewCounter();

    expect((await postViewResponse(request({ slug: "draft-one" }))).status).toBe(204);
    expect((await postViewResponse(request({ slug: "gone" }))).status).toBe(204);

    expect(counter.counts).toEqual({});
  });

  it("اسلاگ ناموجود ردیف نمی‌سازد و وجود/نبودش را لو نمی‌دهد (۲۰۴، نه ۴۰۴)", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "hargez-nabude" }));

    expect(response.status).toBe(204);
    expect(counter.counts).toEqual({});
  });

  it("بدنه‌ی نامعتبر و اسلاگ بدشکل ⟸ ۴۰۰", async () => {
    seedBlog([NEW]);
    seedViewCounter();

    expect((await postViewResponse(request("{ نه JSON"))).status).toBe(400);
    expect((await postViewResponse(request({ slug: "Bad Slug" }))).status).toBe(400);
    expect((await postViewResponse(request({ slug: "../etc/passwd" }))).status).toBe(400);
    expect((await postViewResponse(request({}))).status).toBe(400);
  });

  it("بدنه‌ی غول‌آسا رد می‌شود بدون اینکه parse شود", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "pe", pad: "x".repeat(2000) }));

    expect(response.status).toBe(400);
    expect(counter.counts).toEqual({});
  });

  it("متد دیگر ⟸ ۴۰۵ با هدر Allow", async () => {
    const response = postViewMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("قطع شمارنده ⟸ باز هم ۲۰۴ (کهنگی، نه خطا)", async () => {
    seedBlog([NEW]);
    seedBrokenViewCounter();

    const response = await postViewResponse(request({ slug: "pe" }));

    expect(response.status).toBe(204);
  });
});

describe("ترتیب بر اساس بازدید", () => {
  const posts: PublishedPost[] = [NEW, MID, OLD].map((p) => ({
    ...p,
    status: "published",
    published_at: p.published_at as string,
  }));

  it("بدون هیچ بازدیدی، ترتیب ورودی (تاریخ) دست‌نخورده می‌ماند", () => {
    const counts: ViewCounts = {};
    expect(hasViewData(posts, counts)).toBe(false);
    expect(byPopularity(posts, counts)).toBe(posts);
  });

  it("با بازدید، نزولی بر اساس عدد؛ تساوی با تاریخ شکسته می‌شود", () => {
    const counts: ViewCounts = { alef: 90, be: 5, pe: 90 };
    expect(hasViewData(posts, counts)).toBe(true);
    expect(byPopularity(posts, counts).map((p) => p.slug)).toEqual(["pe", "alef", "be"]);
  });

  it("پستِ بی‌بازدید ته فهرست می‌رود، نه اینکه بیفتد", () => {
    const counts: ViewCounts = { be: 3 };
    expect(byPopularity(posts, counts).map((p) => p.slug)).toEqual(["be", "pe", "alef"]);
  });
});

describe("صفحه‌ی اصلی — کارت‌های انتهای صفحه", () => {
  async function render(views?: ViewCounts): Promise<string> {
    const data = await homeData(healthyStore(), {
      posts: [NEW, MID, OLD],
      ...(views === undefined ? {} : { views }),
    });
    return renderToStaticMarkup(<HomePage data={data} />);
  }

  function bottomSection(html: string): string {
    const start = html.indexOf('aria-labelledby="more-posts-heading"');
    expect(start).toBeGreaterThan(-1);
    return html.slice(start);
  }

  it("بدون داده‌ی بازدید: عنوان خنثی و ترتیب تاریخ", async () => {
    const section = bottomSection(await render());
    expect(section).toContain("بیشتر بخوانید");
    expect(section).not.toContain("پرخواننده‌ترین");
    expect(section.indexOf("عنوان pe")).toBeLessThan(section.indexOf("عنوان alef"));
  });

  it("با داده‌ی بازدید: عنوان «پرخواننده‌ترین» و ترتیب بازدید", async () => {
    const section = bottomSection(await render({ alef: 120, be: 4, pe: 9 }));
    expect(section).toContain("پرخواننده‌ترین نوشته‌ها");
    expect(section).not.toContain("بیشتر بخوانید");
    expect(section.indexOf("عنوان alef")).toBeLessThan(section.indexOf("عنوان pe"));
  });

  it("عدد بازدید هرگز در HTML منتشر نمی‌شود — فقط ترتیب", async () => {
    const html = await render({ alef: 12345, be: 4, pe: 9 });
    expect(html).not.toContain("12345");
    expect(html).not.toContain("۱۲٬۳۴۵");
    expect(html).not.toContain("بازدید");
  });

  it("شمارنده‌ی قطع ⟸ صفحه رندر می‌شود، با ترتیب تاریخ", async () => {
    seedBrokenViewCounter();
    const html = await render();
    expect(html).toContain("بیشتر بخوانید");
    expect(html).toContain("عنوان pe");
  });
});
