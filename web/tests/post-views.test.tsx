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

describe("POST /api/post-view — recording a view", () => {
  it("counts a published post and returns 204 with no cache", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "pe" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(counter.counts["pe"]).toBe(1);
  });

  it("each call adds one", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter({ pe: 7 });

    await postViewResponse(request({ slug: "pe" }));
    await postViewResponse(request({ slug: "pe" }));

    expect(counter.counts["pe"]).toBe(9);
  });

  it("drafts and retracted posts aren't counted — but the response is still 204", async () => {
    seedBlog([
      post("draft-one", { status: "draft", published_at: null }),
      post("gone", { status: "retracted" }),
    ]);
    const counter = seedViewCounter();

    expect((await postViewResponse(request({ slug: "draft-one" }))).status).toBe(204);
    expect((await postViewResponse(request({ slug: "gone" }))).status).toBe(204);

    expect(counter.counts).toEqual({});
  });

  it("a nonexistent slug creates no row and doesn't leak whether it exists (204, not 404)", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "hargez-nabude" }));

    expect(response.status).toBe(204);
    expect(counter.counts).toEqual({});
  });

  it("invalid body and malformed slug ⟸ 400", async () => {
    seedBlog([NEW]);
    seedViewCounter();

    expect((await postViewResponse(request("{ نه JSON"))).status).toBe(400);
    expect((await postViewResponse(request({ slug: "Bad Slug" }))).status).toBe(400);
    expect((await postViewResponse(request({ slug: "../etc/passwd" }))).status).toBe(400);
    expect((await postViewResponse(request({}))).status).toBe(400);
  });

  it("an oversized body is rejected without being parsed", async () => {
    seedBlog([NEW]);
    const counter = seedViewCounter();

    const response = await postViewResponse(request({ slug: "pe", pad: "x".repeat(2000) }));

    expect(response.status).toBe(400);
    expect(counter.counts).toEqual({});
  });

  it("a different method ⟸ 405 with an Allow header", async () => {
    const response = postViewMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("counter outage ⟸ still 204 (staleness, not error)", async () => {
    seedBlog([NEW]);
    seedBrokenViewCounter();

    const response = await postViewResponse(request({ slug: "pe" }));

    expect(response.status).toBe(204);
  });
});

describe("ordering by popularity", () => {
  const posts: PublishedPost[] = [NEW, MID, OLD].map((p) => ({
    ...p,
    status: "published",
    published_at: p.published_at as string,
  }));

  it("with no views at all, the input order (date) stays untouched", () => {
    const counts: ViewCounts = {};
    expect(hasViewData(posts, counts)).toBe(false);
    expect(byPopularity(posts, counts)).toBe(posts);
  });

  it("with views, descending by count; ties are broken by date", () => {
    const counts: ViewCounts = { alef: 90, be: 5, pe: 90 };
    expect(hasViewData(posts, counts)).toBe(true);
    expect(byPopularity(posts, counts).map((p) => p.slug)).toEqual(["pe", "alef", "be"]);
  });

  it("a post with no views sinks to the bottom of the list, it isn't dropped", () => {
    const counts: ViewCounts = { be: 3 };
    expect(byPopularity(posts, counts).map((p) => p.slug)).toEqual(["be", "pe", "alef"]);
  });
});

describe("home page — the bottom-of-page cards", () => {
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

  it("without view data: neutral heading and date order", async () => {
    const section = bottomSection(await render());
    expect(section).toContain("بیشتر بخوانید");
    expect(section).not.toContain("پرخواننده‌ترین");
    expect(section.indexOf("عنوان pe")).toBeLessThan(section.indexOf("عنوان alef"));
  });

  it("with view data: 'most read' heading and view-count order", async () => {
    const section = bottomSection(await render({ alef: 120, be: 4, pe: 9 }));
    expect(section).toContain("پرخواننده‌ترین نوشته‌ها");
    expect(section).not.toContain("بیشتر بخوانید");
    expect(section.indexOf("عنوان alef")).toBeLessThan(section.indexOf("عنوان pe"));
  });

  it("the view count is never published in the HTML — only the order", async () => {
    const html = await render({ alef: 12345, be: 4, pe: 9 });
    expect(html).not.toContain("12345");
    expect(html).not.toContain("۱۲٬۳۴۵");
    expect(html).not.toContain("بازدید");
  });

  it("counter outage ⟸ the page still renders, in date order", async () => {
    seedBrokenViewCounter();
    const html = await render();
    expect(html).toContain("بیشتر بخوانید");
    expect(html).toContain("عنوان pe");
  });
});
