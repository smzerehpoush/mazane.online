/**
 * مرز وب — بلاگ (بلیت ۱۲): استور seed شده ⟸ HTML رندرشده.
 *
 * منبع داده با `setBlogSource` تزریق می‌شود؛ هیچ پستگرس/شبکه‌ای در کار نیست.
 * فیک عمداً «گنگ» است (هرچه seed شده را برمی‌گرداند، با هر وضعیتی) تا قاعده‌ی
 * نمایش — فقط published؛ draft/retracted ⟸ 404/غایب — واقعاً در لایه‌ی وب
 * سنجیده شود، نه در فیک.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import BlogIndex from "../app/blog/page";
import BlogPostPage, {
  generateMetadata,
  generateStaticParams,
} from "../app/blog/[slug]/page";
import sitemap from "../app/sitemap";
import { formatDateFa } from "../lib/format";
import { setBlogSource, type BlogPost } from "../lib/blog";
import { setPriceSource } from "../lib/prices";
import { SITE_URL } from "../lib/site";

/**
 * سایت‌مپ از بلیت ۷ به بعد صفحات دارایی/سکو را هم می‌خواند؛ این تست‌ها
 * فقط رفتار بلاگ را می‌سنجند، پس منبع قیمتِ خالی تزریق می‌شود تا ردیس
 * (منبع پیش‌فرض تنبل) هرگز load نشود. رفتار دارایی/سکوی سایت‌مپ در
 * tests/asset-platform-pages.test.tsx سنجیده می‌شود.
 */
function seedEmptyPrices(): void {
  setPriceSource({
    getListedPlatforms: async () => [],
    getSnapshot: async () => null,
    getUpdatedAt: async () => null,
    getInstruments: async () => [],
  });
}

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

function seedBlog(posts: BlogPost[]): void {
  seedEmptyPrices();
  setBlogSource({
    listPosts: async () => posts,
    getPost: async (slug) => posts.find((p) => p.slug === slug) ?? null,
  });
}

function postPageProps(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

/** خطای notFound نکست — digest بسته به نسخه NEXT_NOT_FOUND یا ‎…;404 است. */
const NOT_FOUND_DIGEST = /NEXT_NOT_FOUND|404/;

function extractJsonLd(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match).not.toBeNull();
  return JSON.parse((match as RegExpMatchArray)[1]) as Record<string, unknown>;
}

describe("فهرست بلاگ — /blog", () => {
  it("پست‌های منتشرشده را با عنوان فارسی، تاریخ فارسی و لینک تخت نشان می‌دهد", async () => {
    seedBlog(ALL_POSTS);
    const html = renderToStaticMarkup(await BlogIndex());

    expect(html).toContain(PUBLISHED_OLD.title_fa);
    expect(html).toContain(PUBLISHED_NEW.title_fa);
    expect(html).toContain('href="/blog/moghayese-karmozd-sakooha"');
    expect(html).toContain('href="/blog/hazine-raft-o-bargasht"');
    // تاریخ انتشار فارسی + <time datetime> با ISO لاتین در خود HTML.
    expect(html).toContain(formatDateFa(PUBLISHED_OLD.published_at as string));
    expect(html).toContain(formatDateFa(PUBLISHED_NEW.published_at as string));
    expect(html).toMatch(/<time [^>]*datetime="2026-08-01T09:00:00.000Z"/i);
  });

  it("نو به کهنه مرتب است — پست تازه‌تر بالاتر", async () => {
    seedBlog(ALL_POSTS);
    const html = renderToStaticMarkup(await BlogIndex());
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeGreaterThan(-1);
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeLessThan(
      html.indexOf(PUBLISHED_OLD.title_fa),
    );
  });

  it("پیش‌نویس و پس‌گرفته در فهرست نیستند", async () => {
    seedBlog(ALL_POSTS);
    const html = renderToStaticMarkup(await BlogIndex());
    expect(html).not.toContain(DRAFT.title_fa);
    expect(html).not.toContain(RETRACTED.title_fa);
  });

  it("بلاگ خالی هم صفحه‌ی سالم می‌دهد", async () => {
    seedBlog([]);
    const html = renderToStaticMarkup(await BlogIndex());
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });
});

describe("صفحه‌ی پست — /blog/[slug]", () => {
  it("عنوان، بدنه‌ی مارک‌داون رندرشده و تاریخ فارسی دارد", async () => {
    seedBlog(ALL_POSTS);
    const html = renderToStaticMarkup(
      await BlogPostPage(postPageProps(PUBLISHED_OLD.slug)),
    );

    expect(html).toContain(`<h1>${PUBLISHED_OLD.title_fa}</h1>`);
    // مارک‌داون واقعاً رندر شده، نه متن خام:
    expect(html).toContain("<h2>چرا کارمزد مهم است</h2>");
    expect(html).toContain("<strong>کارمزد</strong>");
    expect(html).toContain("<li>وال‌گلد</li>");
    expect(html).toContain('<a href="/">صفحه‌ی اصلی</a>');
    expect(html).not.toContain("## چرا");
    // تاریخ انتشار فارسی + datetime لاتین:
    expect(html).toContain(formatDateFa(PUBLISHED_OLD.published_at as string));
    expect(html).toMatch(/<time [^>]*datetime="2026-07-20T08:30:00.000Z"/i);
  });

  it("BlogPosting معتبر در همان رندر سرور — تاریخ‌ها ISO با ارقام لاتین و هم‌ارز داده‌ی seed", async () => {
    seedBlog(ALL_POSTS);
    const html = renderToStaticMarkup(
      await BlogPostPage(postPageProps(PUBLISHED_OLD.slug)),
    );
    const jsonLd = extractJsonLd(html);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("BlogPosting");
    expect(jsonLd.headline).toBe(PUBLISHED_OLD.title_fa);
    expect(jsonLd.inLanguage).toBe("fa");
    expect(jsonLd.datePublished).toBe(PUBLISHED_OLD.published_at);
    expect(jsonLd.dateModified).toBe(PUBLISHED_OLD.updated_at);
    // ارقام لاتین (\d فقط ASCII می‌گیرد):
    expect(jsonLd.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(jsonLd.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(jsonLd.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    });
  });

  it("HTML خام داخل مارک‌داون escape می‌شود، نه اجرا", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        body_md: 'یک پاراگراف با <script>alert("x")</script> داخلش.',
      },
    ]);
    const html = renderToStaticMarkup(
      await BlogPostPage(postPageProps(PUBLISHED_NEW.slug)),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("پیش‌نویس ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(BlogPostPage(postPageProps(DRAFT.slug))).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
  });

  it("پس‌گرفته ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(BlogPostPage(postPageProps(RETRACTED.slug))).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
  });

  it("اسلاگ ناموجود ⟸ 404", async () => {
    seedBlog(ALL_POSTS);
    await expect(BlogPostPage(postPageProps("hich-vaght-nabude"))).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
  });

  it("متادیتای پست canonical تخت زیر /blog/ دارد", async () => {
    seedBlog(ALL_POSTS);
    const metadata = await generateMetadata(postPageProps(PUBLISHED_OLD.slug));
    expect(metadata.title).toBe(PUBLISHED_OLD.title_fa);
    expect(metadata.alternates?.canonical).toBe(
      `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    );
  });

  it("generateStaticParams فقط اسلاگ‌های منتشرشده را می‌دهد", async () => {
    seedBlog(ALL_POSTS);
    const params = await generateStaticParams();
    const slugs = params.map((p) => p.slug);
    expect(slugs).toContain(PUBLISHED_OLD.slug);
    expect(slugs).toContain(PUBLISHED_NEW.slug);
    expect(slugs).not.toContain(DRAFT.slug);
    expect(slugs).not.toContain(RETRACTED.slug);
  });
});

describe("استور بلاگ از دسترس خارج (مثلاً build بیرون از سرور) — کهنگی/خالی، نه شکست", () => {
  function seedBrokenSource(): void {
    seedEmptyPrices();
    setBlogSource({
      listPosts: async () => {
        throw new Error("pg down");
      },
      getPost: async () => {
        throw new Error("pg down");
      },
    });
  }

  it("فهرست بلاگ باز هم ۲۰۰ می‌دهد — حالت خالی", async () => {
    seedBrokenSource();
    const html = renderToStaticMarkup(await BlogIndex());
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });

  it("سایت‌مپ باز هم ساخته می‌شود و صفحه‌ی اصلی را دارد", async () => {
    seedBrokenSource();
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/`);
  });

  it("generateStaticParams خالی می‌دهد (اسلاگ‌ها بعداً on-demand ساخته می‌شوند)", async () => {
    seedBrokenSource();
    await expect(generateStaticParams()).resolves.toEqual([]);
  });

  it("صفحه‌ی پست خطای استور را ۴۰۴ جا نمی‌زند — خطا بالا می‌رود تا ایندکس نسوزد", async () => {
    seedBrokenSource();
    await expect(BlogPostPage(postPageProps(PUBLISHED_OLD.slug))).rejects.toThrow(
      "pg down",
    );
  });
});

describe("سایت‌مپ — حداقلی و درست (بلیت ۱۰ گسترش می‌دهد)", () => {
  it("صفحه‌ی اصلی و پست‌های منتشرشده را دارد؛ lastmod پست = updated_at خودش، نه now()", async () => {
    seedBlog(ALL_POSTS);
    const entries = await sitemap();

    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/blog/${PUBLISHED_OLD.slug}`);
    expect(urls).toContain(`${SITE_URL}/blog/${PUBLISHED_NEW.slug}`);

    const oldEntry = entries.find(
      (e) => e.url === `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    );
    expect(oldEntry?.lastModified).toBe(PUBLISHED_OLD.updated_at);

    // قیمت لحظه‌ای lastmod نیست: صفحه‌ی اصلی اصلاً lastModified ندارد (بند ۶.۷).
    const homeEntry = entries.find((e) => e.url === `${SITE_URL}/`);
    expect(homeEntry?.lastModified).toBeUndefined();
  });

  it("پیش‌نویس و پس‌گرفته در سایت‌مپ نیستند", async () => {
    seedBlog(ALL_POSTS);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain(`${SITE_URL}/blog/${DRAFT.slug}`);
    expect(urls).not.toContain(`${SITE_URL}/blog/${RETRACTED.slug}`);
  });
});
