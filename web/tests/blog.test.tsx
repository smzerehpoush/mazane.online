/**
 * مرز وب — بلاگ (بلیت ۱۲): استور seed شده ⟸ HTML رندرشده.
 *
 * منبع داده با `setBlogSource` تزریق می‌شود؛ هیچ پستگرس/شبکه‌ای در کار نیست.
 * فیک عمداً «گنگ» است (هرچه seed شده را برمی‌گرداند، با هر وضعیتی) تا قاعده‌ی
 * نمایش — فقط published؛ draft/retracted ⟸ 404/غایب — واقعاً در لایه‌ی وب
 * سنجیده شود، نه در فیک.
 *
 * مسیرهای ‎/blog‎ و ‎/blog/<slug>‎ فقط سیم‌کشی‌اند؛ «۴۰۴» در این مرز یعنی
 * `getPublishedPost(...) === null` و مسیر همان را به `notFound()` ترجمه می‌کند.
 */
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

/** فهرست بلاگ همان‌طور که مسیر می‌سازدش: قاعده‌ی نمایش در `lib/blog.ts`. */
async function renderIndex(): Promise<string> {
  return renderToStaticMarkup(<BlogIndexView posts={await listPublishedPosts()} />);
}

/** صفحه‌ی پست — `null` یعنی ۴۰۴ و مسیر همان‌جا `notFound()` می‌اندازد. */
async function renderPost(slug: string): Promise<string> {
  const post = await getPublishedPost(slug);
  if (post === null) throw new Error(`پست ${slug} ۴۰۴ شد`);
  return renderToStaticMarkup(<BlogPostView post={post} />);
}

function jsonLdOf(head: ReturnType<typeof blogPostHead>): Record<string, unknown>[] {
  return (head.scripts ?? []).map(
    (script) => JSON.parse(script.children) as Record<string, unknown>,
  );
}

describe("فهرست بلاگ — /blog", () => {
  it("پست‌های منتشرشده را با عنوان فارسی، تاریخ فارسی و لینک تخت نشان می‌دهد", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderIndex();

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
    const html = await renderIndex();
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeGreaterThan(-1);
    expect(html.indexOf(PUBLISHED_NEW.title_fa)).toBeLessThan(
      html.indexOf(PUBLISHED_OLD.title_fa),
    );
  });

  it("پیش‌نویس و پس‌گرفته در فهرست نیستند", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderIndex();
    expect(html).not.toContain(DRAFT.title_fa);
    expect(html).not.toContain(RETRACTED.title_fa);
  });

  it("بلاگ خالی هم صفحه‌ی سالم می‌دهد", async () => {
    seedBlog([]);
    const html = await renderIndex();
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });

  it("سرصفحه‌اش canonical و BreadcrumbList دارد (بند ۶.۵)", () => {
    const head = blogIndexHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/blog` });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
  });

  it("کارت پست با عکس شاخص: img با src/width/height/alt (بلیت ۲۵)", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        image_url: "https://cdn.mazane.online/posts/x/h.webp",
        image_alt: "توضیح عکس",
        image_width: 1600,
        image_height: 900,
      },
      PUBLISHED_OLD,
    ]);
    const html = await renderIndex();
    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn\.mazane\.online\/posts\/x\/h\.webp"[^>]*>/);
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('alt="توضیح عکس"');
  });

  it("کارت پست بدون عکس: هیچ img ای نیست و چیدمان امروز دست‌نخورده می‌ماند", async () => {
    seedBlog([PUBLISHED_OLD]);
    const html = await renderIndex();
    expect(html).not.toContain("<img");
  });
});

describe("صفحه‌ی پست — /blog/[slug]", () => {
  it("عنوان، بدنه‌ی مارک‌داون رندرشده و تاریخ فارسی دارد", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderPost(PUBLISHED_OLD.slug);

    expect(html).toMatch(
      new RegExp(`<h1[^>]*>${PUBLISHED_OLD.title_fa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h1>`),
    );
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

  it("عکس شاخص (بلیت ۲۴): src/width/height/alt/loading=eager بالای محتوا", async () => {
    seedBlog([
      {
        ...PUBLISHED_NEW,
        image_url: "https://cdn.mazane.online/posts/x/h.webp",
        image_alt: "توضیح عکس",
        image_width: 1600,
        image_height: 900,
      },
    ]);
    const html = await renderPost(PUBLISHED_NEW.slug);

    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn\.mazane\.online\/posts\/x\/h\.webp"[^>]*>/);
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('alt="توضیح عکس"');
    expect(html).toContain('loading="eager"');
    // بالای محتوا: پیش از بدنه‌ی مارک‌داونِ رندرشده می‌آید.
    expect(html.indexOf("<img")).toBeGreaterThan(-1);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(PUBLISHED_NEW.body_md));
  });

  it("پستِ بدون عکس دقیقاً رندر امروز است — هیچ img ای نیست", async () => {
    seedBlog(ALL_POSTS);
    const html = await renderPost(PUBLISHED_OLD.slug);
    expect(html).not.toContain("<img");
  });

  it("BlogPosting معتبر با تاریخ‌های ISO لاتین و هم‌ارز داده‌ی seed", async () => {
    seedBlog(ALL_POSTS);
    const post = (await getPublishedPost(PUBLISHED_OLD.slug)) as PublishedPost;
    const [blogPosting] = jsonLdOf(blogPostHead(post));

    expect(blogPosting?.["@context"]).toBe("https://schema.org");
    expect(blogPosting?.["@type"]).toBe("BlogPosting");
    expect(blogPosting?.["headline"]).toBe(PUBLISHED_OLD.title_fa);
    expect(blogPosting?.["inLanguage"]).toBe("fa");
    expect(blogPosting?.["datePublished"]).toBe(PUBLISHED_OLD.published_at);
    expect(blogPosting?.["dateModified"]).toBe(PUBLISHED_OLD.updated_at);
    // ارقام لاتین (\d فقط ASCII می‌گیرد):
    expect(blogPosting?.["datePublished"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(blogPosting?.["dateModified"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(blogPosting?.["mainEntityOfPage"]).toEqual({
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${PUBLISHED_OLD.slug}`,
    });
  });

  it("ترتیب اسکریپت‌ها عمدی است: BlogPosting اول، BreadcrumbList بعد", async () => {
    seedBlog(ALL_POSTS);
    const post = (await getPublishedPost(PUBLISHED_OLD.slug)) as PublishedPost;
    const blocks = jsonLdOf(blogPostHead(post));
    expect(blocks.map((block) => block["@type"])).toEqual([
      "BlogPosting",
      "BreadcrumbList",
    ]);
  });

  it("HTML خام داخل مارک‌داون escape می‌شود، نه اجرا", async () => {
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

  it("پیش‌نویس ⟸ ۴۰۴", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost(DRAFT.slug)).resolves.toBeNull();
  });

  it("پس‌گرفته ⟸ ۴۰۴", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost(RETRACTED.slug)).resolves.toBeNull();
  });

  it("اسلاگ ناموجود ⟸ ۴۰۴", async () => {
    seedBlog(ALL_POSTS);
    await expect(getPublishedPost("hich-vaght-nabude")).resolves.toBeNull();
  });

  it("سرصفحه‌ی ۴۰۴ صریحاً noindex است — صفحه‌ی نبوده ایندکس نمی‌شود", () => {
    const head = blogPostHead(undefined);
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(head.scripts).toBeUndefined();
  });

  it("سرصفحه‌ی پست canonical تخت زیر /blog/ دارد", async () => {
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

describe("استور بلاگ از دسترس خارج (مثلاً build بیرون از سرور) — کهنگی/خالی، نه شکست", () => {
  /** ⚠️ مستقیم `setBlogSource` — کمک‌کار seed فقط منبع سالم می‌سازد. */
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

  it("فهرست بلاگ باز هم ۲۰۰ می‌دهد — حالت خالی", async () => {
    seedBrokenSource();
    const html = await renderIndex();
    expect(html).toContain("هنوز پستی منتشر نشده است");
  });

  it("صفحه‌ی پست خطای استور را ۴۰۴ جا نمی‌زند — خطا بالا می‌رود تا ایندکس نسوزد", async () => {
    seedBrokenSource();
    await expect(getPublishedPost(PUBLISHED_OLD.slug)).rejects.toThrow("pg down");
  });
});

describe("سایت‌مپ بلاگ (بند ۶.۷)", () => {
  it("lastmod پست = updated_at خودش، نه now()؛ صفحات دیگر lastmod ندارند", async () => {
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

    // قیمت لحظه‌ای lastmod نیست: صفحه‌ی اصلی اصلاً lastModified ندارد.
    expect(entries.find((entry) => entry.path === "/")?.lastModified).toBeUndefined();
  });

  it("پیش‌نویس و پس‌گرفته در سایت‌مپ نیستند", async () => {
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
