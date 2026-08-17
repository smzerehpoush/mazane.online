import { Breadcrumbs } from "@/components/content/PageShell";
import { ViewBeacon } from "@/components/content/ViewBeacon";
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";
import { excerptFa, renderMarkdown } from "@/lib/markdown";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/structured-data";

export const BLOG_INDEX_TITLE = "بلاگ تابلو";
export const BLOG_INDEX_DESCRIPTION =
  "تحلیل‌های داده‌محور از کارمزد خرید و فروش و هزینه‌ی رفت‌وبرگشت در سکوهای طلای آنلاین.";

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
          {posts.map((post) => {
            const image = postImageAsset(post);
            const text = (
              <>
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
              </>
            );
            return (
              <li key={post.slug}>
                <article
                  className={`glass-surface lift-hover px-5 py-5 sm:px-6 ${
                    image !== null ? "flex items-center gap-4" : ""
                  }`}
                >
                  {image !== null ? (
                    <>
                      <img
                        src={image.url}
                        width={image.width}
                        height={image.height}
                        alt={image.alt}
                        loading="lazy"
                        className="size-16 shrink-0 rounded-xl object-cover sm:size-20"
                      />
                      <div className="min-w-0 flex-1">{text}</div>
                    </>
                  ) : (
                    text
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function blogPostingJsonLd(post: PublishedPost): string {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = postImageAsset(post);
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title_fa,
    inLanguage: "fa",
    datePublished: post.published_at,
    dateModified: post.updated_at,
    url,
    ...(image !== null ? { image: image.url } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "تابلو", url: SITE_URL },
    publisher: { "@type": "Organization", name: "تابلو", url: SITE_URL },
  });
}

export function blogPostHead(post: PublishedPost | undefined) {
  if (post === undefined) {
    return { meta: [{ title: "پست یافت نشد" }, { name: "robots", content: "noindex" }] };
  }
  const url = `${SITE_URL}/blog/${post.slug}`;
  const description = excerptFa(post.body_md);
  const image = postImageAsset(post);
  return {
    meta: [
      { title: post.title_fa },
      { name: "description", content: description },
      { property: "og:title", content: post.title_fa },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      ...(image !== null
        ? [
            { property: "og:image", content: image.url },
            { property: "og:image:width", content: String(image.width) },
            { property: "og:image:height", content: String(image.height) },
            { name: "twitter:image", content: image.url },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : []),
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

const PROSE =
  "space-y-4 text-[15px] leading-8 text-foreground/90 " +
  "[&_h2]:mt-9 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_h3]:mt-7 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground " +
  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pr-6 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 " +
  "[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] " +
  "[&_strong]:font-semibold [&_strong]:text-foreground";

export function BlogPostView({ post }: { post: PublishedPost }) {
  const image = postImageAsset(post);

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
        {image !== null ? (
          <img
            src={image.url}
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="eager"
            className="mt-6 w-full rounded-2xl"
          />
        ) : null}
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
