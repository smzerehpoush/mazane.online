import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BlogIndexView,
  BlogPostView,
  blogIndexHead,
  blogPostHead,
} from "../src/components/content/BlogViews";
import {
  getPublishedPost,
  listPublishedPosts,
  setBlogSource,
  type BlogPost,
  type PublishedPost,
} from "../src/lib/blog";
import { formatDateFa } from "../src/lib/format";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { seedBlog } from "./support/seed";

const PUBLISHED_OLD: BlogPost = {
  slug: "moghayese-karmozd-sakooha",
  title_fa: "مقایسه‌ی کارمزد سکوهای طلای آنلاین",
  body_md: [
    "## چرا کارمزد مهم است",
    "",
    "قیمت پایه‌ی سکوها تقریباً یکسان است؛ **کارمزد** است که فرق می‌سازد.",
    "",
    "- وال‌گلد",
    "- طلاسی",
    "",
    "جزئیات در [صفحه‌ی اصلی](/) آمده است.",
  ].join("\n"),
  status: "published",
  published_at: "2026-07-20T08:30:00.000Z",
  updated_at: "2026-07-22T10:00:00.000Z",
};

const PUBLISHED_NEW: BlogPost = {
  slug: "hazine-raft-o-bargasht",
  title_fa: "هزینه‌ی رفت‌وبرگشت چیست؟",
  body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.",
  status: "published",
  published_at: "2026-08-01T09:00:00.000Z",
  updated_at: "2026-08-01T09:00:00.000Z",
};

const DRAFT: BlogPost = {
  slug: "pish-nevis-montasher-nashode",
  title_fa: "پیش‌نویس منتشرنشده",
  body_md: "هنوز در صف است.",
  status: "draft",
  published_at: null,
  updated_at: "2026-08-03T12:00:00.000Z",
};

const RETRACTED: BlogPost = {
  slug: "post-pas-gerefte",
  title_fa: "پست پس‌گرفته‌شده",
  body_md: "این پست پس گرفته شد.",
  status: "retracted",
  published_at: "2026-07-01T07:00:00.000Z",
  updated_at: "2026-07-05T07:00:00.000Z",
};

const ALL_POSTS: BlogPost[] = [PUBLISHED_OLD, PUBLISHED_NEW, DRAFT, RETRACTED];

async function renderIndex(): Promise<string> {
  return renderToStaticMarkup(<BlogIndexView posts={await listPublishedPosts()} />);
}

async function renderPost(slug: string): Promise<string> {
  const post = await getPublishedPost(slug);
  if (post === null) throw new Error(`post ${slug} returned 404`);
  return renderToStaticMarkup(<BlogPostView post={post} />);
}

function jsonLdOf(head: ReturnType<typeof blogPostHead>): Record<string, unknown>[] {
  return (head.scripts ?? []).map(
    (script) => JSON.parse(script.children) as Record<string, unknown>,
  );
}

describe("blog index — /blog", () => {
  it("shows published posts with Persian title, Persian date, and a flat link", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderIndex();

    expect(html).toContain(PUBLISHED_OLD.title_fa);
    expect(html).toContain(PUBLISHED_NEW.title_fa);
    expect(html).toContain('href="/blog/moghayese-karmozd-sakooha"');
    expect(html).toContain('href="/blog/hazine-raft-o-bargasht"');
    expect(html).toContain(formatDateFa(PUBLISHED_OLD.published_at as string));
    expect(html).toContain(formatDateFa(PUBLISHED_NEW.published_at as string));
    expect(html).toMatch(/<time [^>]*datetime="2026-08-01T09:00:00.000Z"/i);
  });

  it("sorted newest to oldest — the newer post is higher", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderIndex();
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeGreaterThan(-1);
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeLessThan(html.indexOf(PUBLISHED_OLD.title_fa));
  });

  it("draft and retracted posts are not in the list", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderIndex();
    expect(html).not.toContain(DRAFT.title_fa);
    expect(html).not.toContain(RETRACTED.title_fa);
  });

  it("an empty blog still renders a healthy page", async () => {
    seedBlog([]);
    const html = await renderIndex();
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });

  it("its head has canonical and BreadcrumbList", () => {
    const head = blogIndexHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/blog` });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
  });

  it("post card with a featured image: img with src/width/height/alt", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        image_url: "https://s3.tablo.test/tablo-media/posts/x/h.webp",
        image_alt: "توضیح عکس",
        image_width: 1600,
        image_height: 900,
      },
      PUBLISHED_OLD,
    ]);
    const html = await renderIndex();
    expect(html).toMatch(
      /<img[^>]*src="https:\/\/s3\.tablo\.test\/tablo-media\/posts\/x\/h\.webp"[^>]*>/,
    );
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('alt="توضیح عکس"');
  });

  it("post card without an image: no img at all, and today's layout stays untouched", async () => {
    seedBlog([PUBLISHED_OLD]);
    const html = await renderIndex();
    expect(html).not.toContain("<img");
  });
});

describe("post page — /blog/[slug]", () => {
  it("has the title, rendered markdown body, and Persian date", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderPost(PUBLISHED_OLD.slug);

    expect(html).toMatch(
      new RegExp(`<h1[^>]*>${PUBLISHED_OLD.title_fa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h1>`),
    );
    expect(html).toContain("<h2>چرا کارمزد مهم است</h2>");
    expect(html).toContain("<strong>کارمزد</strong>");
    expect(html).toContain("<li>وال‌گلد</li>");
    expect(html).toContain('<a href="/">صفحه‌ی اصلی</a>');
    expect(html).not.toContain("## چرا");
    expect(html).toContain(formatDateFa(PUBLISHED_OLD.published_at as string));
    expect(html).toMatch(/<time [^>]*datetime="2026-07-20T08:30:00.000Z"/i);
  });

  it("featured image: src/width/height/alt/loading=eager above the content", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        image_url: "https://s3.tablo.test/tablo-media/posts/x/h.webp",
        image_alt: "توضیح عکس",
        image_width: 1600,
        image_height: 900,
      },
    ]);
    const html = await renderPost(PUBLISHED_NEW.slug);

    expect(html).toMatch(
      /<img[^>]*src="https:\/\/s3\.tablo\.test\/tablo-media\/posts\/x\/h\.webp"[^>]*>/,
    );
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('alt="توضیح عکس"');
    expect(html).toContain('loading="eager"');
    expect(html.indexOf("<img")).toBeGreaterThan(-1);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(PUBLISHED_NEW.body_md));
  });

  it("a post without an image renders exactly like today — no img at all", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderPost(PUBLISHED_OLD.slug);
    expect(html).not.toContain("<img");
  });

  it("valid BlogPosting with Latin ISO dates matching the seeded data", async () => {
    seedBlog(ALL_POSTS);
    const post = (await getPublishedPost(PUBLISHED_OLD.slug)) as PublishedPost;
    const [blogPosting] = jsonLdOf(blogPostHead(post));

    expect(blogPosting?.["@context"]).toBe("https://schema.org");
    expect(blogPosting?.["@type"]).toBe("BlogPosting");
    expect(blogPosting?.["headline"]).toBe(PUBLISHED_OLD.title_fa);
    expect(blogPosting?.["inLanguage"]).toBe("fa");
    expect(blogPosting?.["datePublished"]).toBe(PUBLISHED_OLD.published_at);
    expect(blogPosting?.["dateModified"]).toBe(PUBLISHED_OLD.updated_at);
    expect(blogPosting?.["datePublished"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(blogPosting?.["dateModified"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(blogPosting?.["mainEntityOfPage"]).toEqual({
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    });
  });

  it("script order is intentional: BlogPosting first, BreadcrumbList after", async () => {
    seedBlog(ALL_POSTS);
    const post = (await getPublishedPost(PUBLISHED_OLD.slug)) as PublishedPost;
    const blocks = jsonLdOf(blogPostHead(post));
    expect(blocks.map((block) => block["@type"])).toEqual(["BlogPosting", "BreadcrumbList"]);
  });

  it("raw HTML inside markdown is escaped, not executed", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        body_md: 'یک پاراگراف با <script>alert("x")</script> داخلش.',
      },
    ]);
    const html = await renderPost(PUBLISHED_NEW.slug);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("draft ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost(DRAFT.slug)).resolves.toBeNull();
  });

  it("retracted ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost(RETRACTED.slug)).resolves.toBeNull();
  });

  it("nonexistent slug ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost("hich-vaght-nabude")).resolves.toBeNull();
  });

  it("the 404 head is explicitly noindex — a nonexistent page never gets indexed", () => {
    const head = blogPostHead(undefined);
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(head.scripts).toBeUndefined();
  });

  it("the post head has a flat canonical under /blog/", async () => {
    seedBlog(ALL_POSTS);
    const post = (await getPublishedPost(PUBLISHED_OLD.slug)) as PublishedPost;
    const head = blogPostHead(post);
    expect(head.meta?.[0]).toEqual({ title: PUBLISHED_OLD.title_fa });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    });
  });
});

describe("blog store unreachable (e.g. a build outside the server) — staleness/empty, not failure", () => {
  /** ⚠️ Calls `setBlogSource` directly — the seed helper only builds a healthy source. */
  function seedBrokenSource(): void {
    setBlogSource({
      listPosts: async () => {
        throw new Error("pg down");
      },
      getPost: async () => {
        throw new Error("pg down");
      },
    });
  }

  it("the blog index still returns 200 — empty state", async () => {
    seedBrokenSource();
    const html = await renderIndex();
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });

  it("the post page doesn't disguise a store error as 404 — the error propagates so indexing doesn't get burned", async () => {
    seedBrokenSource();
    await expect(getPublishedPost(PUBLISHED_OLD.slug)).rejects.toThrow("pg down");
  });
});

describe("blog sitemap", () => {
  it("post lastmod = its own updated_at, not now(); other pages have no lastmod", async () => {
    seedBlog(ALL_POSTS);
    const entries = buildSitemapEntries({
      posts: await listPublishedPosts(),
      instruments: [],
      platforms: [],
    });
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("/");
    expect(paths).toContain(`/blog/${PUBLISHED_OLD.slug}`);
    expect(paths).toContain(`/blog/${PUBLISHED_NEW.slug}`);
    expect(
      entries.find((entry) => entry.path === `/blog/${PUBLISHED_OLD.slug}`)?.lastModified,
    ).toBe(PUBLISHED_OLD.updated_at);

    expect(entries.find((entry) => entry.path === "/")?.lastModified).toBeUndefined();
  });

  it("draft and retracted posts are not in the sitemap", async () => {
    seedBlog(ALL_POSTS);
    const paths = buildSitemapEntries({
      posts: await listPublishedPosts(),
      instruments: [],
      platforms: [],
    }).map((entry) => entry.path);
    expect(paths).not.toContain(`/blog/${DRAFT.slug}`);
    expect(paths).not.toContain(`/blog/${RETRACTED.slug}`);
  });
});
