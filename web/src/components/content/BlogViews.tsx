/**
 * نمای فهرست بلاگ و نمای پست بلاگ، به‌همراه سرصفحه‌های‌شان — **بدون وابستگی
 * به روتر** (همان دلیل `SlugPageView.tsx`): مرز تست وب «استور seed شده ⟸
 * خروجی رندرشده» است و مسیر تنکستک بدون بستر روتر رندر نمی‌شود.
 *
 * بدنه‌ی پست مارک‌داون است و با `lib/markdown.tsx` به درخت ری‌اکت رندر می‌شود —
 * هیچ `dangerouslySetInnerHTML` روی متن پست نیست، پس HTML داخل بدنه همیشه
 * escape می‌شود.
 *
 * `BlogPosting` در همان رندر سرور ساخته می‌شود (بند ۶.۵) — متن فارسی،
 * تاریخ‌ها ISO با ارقام لاتین، URL بوم لاتینِ تخت زیر ‎/blog/‎. ترتیب
 * اسکریپت‌ها عمدی است: BlogPosting اول، BreadcrumbList بعد.
 */
import { Breadcrumbs } from "@/components/content/PageShell";
import { ViewBeacon } from "@/components/content/ViewBeacon";
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { excerptFa, renderMarkdown } from "@/lib/markdown";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/structured-data";

/* ------------------------------------------------------------ فهرست بلاگ */

export const BLOG_INDEX_TITLE = "بلاگ مظنه آنلاین";
export const BLOG_INDEX_DESCRIPTION =
  "تحلیل‌های داده‌محور از کارمزد، قیمت مؤثر و هزینه‌ی رفت‌وبرگشت طلای آنلاین.";

export function blogIndexHead() {
  return {
    meta: [
      { title: BLOG_INDEX_TITLE },
      { name: "description", content: BLOG_INDEX_DESCRIPTION },
      { property: "og:title", content: BLOG_INDEX_TITLE },
      { property: "og:description", content: BLOG_INDEX_DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
    // بند ۶.۵: BreadcrumbList همه‌جا جز ریشه.
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "بلاگ", url: `${SITE_URL}/blog` },
        ]),
      },
    ],
  };
}

/** قطع پستگرس ⟸ فهرست خالی و ۲۰۰، نه خطا (قاعده‌ی ۵ قراردادها). */
export function BlogIndexView({ posts }: { posts: PublishedPost[] }) {
  return (
    <>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "بلاگ" }]} />

      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">{BLOG_INDEX_TITLE}</h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">
          {BLOG_INDEX_DESCRIPTION}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="glass-surface px-5 py-8 text-center text-sm text-muted-foreground">
          هنوز پستی منتشر نشده است.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="glass-surface lift-hover px-5 py-5 sm:px-6">
                <h2 className="text-[15px] leading-7 font-semibold sm:text-base">
                  <a
                    href={`/blog/${post.slug}`}
                    className="transition-smooth hover:text-primary"
                  >
                    {post.title_fa}
                  </a>
                </h2>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  انتشار:{" "}
                  <time dateTime={post.published_at}>
                    {formatDateFa(post.published_at)}
                  </time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* --------------------------------------------------------------- یک پست */

function blogPostingJsonLd(post: PublishedPost): string {
  const url = `${SITE_URL}/blog/${post.slug}`;
  // سریال‌سازی و escape در lib/structured-data.ts (بلیت ۱۰) — همان رسم قبلی.
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title_fa,
    inLanguage: "fa",
    datePublished: post.published_at,
    dateModified: post.updated_at,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "مظنه آنلاین", url: SITE_URL },
    publisher: { "@type": "Organization", name: "مظنه آنلاین", url: SITE_URL },
  });
}

/**
 * پیش‌نویس/پس‌گرفته/ناموجود ⟸ ۴۰۴ با متای `noindex` (قاعده‌ی نمایش در
 * `lib/blog.ts`؛ پس‌گیری در `collector/.../content/retract.py`).
 */
export function blogPostHead(post: PublishedPost | undefined) {
  if (post === undefined) {
    return { meta: [{ title: "پست یافت نشد" }, { name: "robots", content: "noindex" }] };
  }
  const url = `${SITE_URL}/blog/${post.slug}`;
  const description = excerptFa(post.body_md);
  return {
    meta: [
      { title: post.title_fa },
      { name: "description", content: description },
      { property: "og:title", content: post.title_fa },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      { type: "application/ld+json", children: blogPostingJsonLd(post) },
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "بلاگ", url: `${SITE_URL}/blog` },
          { name: post.title_fa, url },
        ]),
      },
    ],
  };
}

/**
 * قالب‌بندی بدنه‌ی مارک‌داون. `renderMarkdown` عناصر برهنه می‌دهد؛ استایل با
 * واریانت‌های فرزند اعمال می‌شود تا شیوه‌نامه‌ی سراسری دست‌نخورده بماند.
 */
const PROSE =
  "space-y-4 text-[15px] leading-8 text-foreground/90 " +
  "[&_h2]:mt-9 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_h3]:mt-7 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground " +
  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pr-6 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 " +
  "[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] " +
  "[&_strong]:font-semibold [&_strong]:text-foreground";

export function BlogPostView({ post }: { post: PublishedPost }) {
  return (
    <>
      <ViewBeacon slug={post.slug} />
      <Breadcrumbs
        items={[
          { label: "خانه", href: "/" },
          { label: "بلاگ", href: "/blog" },
          { label: post.title_fa },
        ]}
      />

      <article className="glass-surface px-5 py-7 sm:px-8 sm:py-9">
        <h1 className="text-xl leading-9 font-bold sm:text-2xl">{post.title_fa}</h1>
        <p className="mt-3 border-b border-border/70 pb-5 text-[11px] text-muted-foreground">
          انتشار:{" "}
          <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
          {post.updated_at !== post.published_at ? (
            <>
              {" — "}به‌روزرسانی:{" "}
              <time dateTime={post.updated_at}>{formatDateFa(post.updated_at)}</time>
            </>
          ) : null}
        </p>
        <div className={`mt-6 ${PROSE}`}>{renderMarkdown(post.body_md)}</div>
      </article>

      <p className="mt-6 text-[12px]">
        <a href="/blog" className="transition-smooth text-primary hover:underline">
          بازگشت به فهرست بلاگ
        </a>
      </p>
    </>
  );
}
