/**
 * صفحه‌ی پست بلاگ — ‎/blog/[slug]‎ (بلیت ۱۲): SSG کامل (بند ۶.۲) با بازتولید
 * هنگام انتشار/ویرایش، بدون دیپلوی مجدد:
 *
 *   - صف انتشار (بلیت ۱۳) پس از هر انتشار/ویرایش `POST /api/revalidate-blog`
 *     را صدا می‌زند (قرارداد در app/api/revalidate-blog/route.ts).
 *   - `dynamicParams` روشن است، پس اسلاگی که بعد از build منتشر شود هم در
 *     اولین درخواست ساخته و از آن به بعد ایستا سرو می‌شود.
 *   - پس‌گیری (`retracted`) یا پیش‌نویس ⟸ همین صفحه 404 می‌دهد (قاعده‌ی
 *     نمایش در lib/blog.ts).
 *
 * `BlogPosting` در همان رندر سرور ساخته می‌شود (بند ۶.۵) — متن فارسی،
 * تاریخ‌ها ISO با ارقام لاتین، URL بوم (canonical) لاتینِ تخت زیر ‎/blog/‎.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedPost, listPublishedPosts, type PublishedPost } from "../../../lib/blog";
import { formatDateFa } from "../../../lib/format";
import { excerptFa, renderMarkdown } from "../../../lib/markdown";
import { SITE_URL } from "../../../lib/site";
import { breadcrumbJsonLd, jsonLdString } from "../../../lib/structured-data";
import { JsonLdScript } from "../../json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

/** اسلاگ تازه‌منتشرشده (بعد از build) هم on-demand رندر می‌شود. */
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // build بیرون از سرور (بند ۱۳، تصمیم ۵) شاید به پایگاه دسترسی نداشته باشد؛
  // listPublishedPosts در آن حالت [] می‌دهد و dynamicParams صفحه‌ها را در
  // اولین درخواست می‌سازد.
  const posts = await listPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (post === null) {
    return { title: "پست یافت نشد" };
  }
  return {
    title: post.title_fa,
    description: excerptFa(post.body_md),
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
  };
}

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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (post === null) notFound();

  return (
    <main>
      {/* BlogPosting اول می‌ماند (قرارداد تست بلیت ۱۲)؛ BreadcrumbList
          بند ۶.۵ بعد از آن. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post) }}
      />
      <JsonLdScript
        json={breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "بلاگ", url: `${SITE_URL}/blog` },
          { name: post.title_fa, url: `${SITE_URL}/blog/${post.slug}` },
        ])}
      />
      <article>
        <h1>{post.title_fa}</h1>
        <p>
          انتشار:{" "}
          <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
          {post.updated_at !== post.published_at ? (
            <>
              {" — "}به‌روزرسانی:{" "}
              <time dateTime={post.updated_at}>{formatDateFa(post.updated_at)}</time>
            </>
          ) : null}
        </p>
        {renderMarkdown(post.body_md)}
      </article>
    </main>
  );
}
