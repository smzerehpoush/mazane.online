/**
 * فهرست بلاگ — ‎/blog‎ (بلیت ۱۲): پست‌های منتشرشده، نو به کهنه، تاریخ فارسی.
 *
 * ایستا ساخته می‌شود و با انتشار/ویرایش/پس‌گیریِ پست بدون دیپلوی بازتولید
 * می‌شود: صف انتشار (بلیت ۱۳) `POST /api/revalidate-blog` را صدا می‌زند
 * (قرارداد کامل در app/api/revalidate-blog/route.ts).
 *
 * پیش‌نویس و پس‌گرفته اصلاً به این صفحه نمی‌رسند — قاعده‌ی نمایش در
 * lib/blog.ts است و همان‌جا تست می‌شود.
 */
import type { Metadata } from "next";

import { listPublishedPosts } from "../../lib/blog";
import { formatDateFa } from "../../lib/format";
import { SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "بلاگ مظنه آنلاین",
  description:
    "تحلیل‌های داده‌محور از کارمزد، قیمت مؤثر و هزینه‌ی رفت‌وبرگشت طلای آنلاین.",
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default async function BlogIndex() {
  const posts = await listPublishedPosts();

  return (
    <main>
      <h1>بلاگ مظنه آنلاین</h1>

      {posts.length === 0 ? (
        <p>هنوز پستی منتشر نشده است.</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2>
                  <a href={`/blog/${post.slug}`}>{post.title_fa}</a>
                </h2>
                <p>
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
    </main>
  );
}
