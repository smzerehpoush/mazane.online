/**
 * فهرست بلاگ — ‎/blog‎ (بلیت ۱۲): پست‌های منتشرشده، نو به کهنه، تاریخ فارسی.
 *
 * پیش‌نویس و پس‌گرفته اصلاً به این صفحه نمی‌رسند — قاعده‌ی نمایش در
 * `lib/blog.ts` است و همان‌جا تست می‌شود.
 *
 * قطع پستگرس ⟸ فهرست خالی و ۲۰۰، نه خطا (قاعده‌ی ۵ قراردادها). همین حالت
 * است که build بیرون از سرور را ممکن می‌کند.
 *
 * این فایل فقط سیم‌کشی است؛ نما و سرصفحه در `components/content/BlogViews.tsx`
 * اند تا بدون بستر روتر تست شوند.
 */
import { createFileRoute } from "@tanstack/react-router";

import { BlogIndexView, blogIndexHead } from "@/components/content/BlogViews";
import { PageShell } from "@/components/content/PageShell";
import { loadBlogIndex } from "@/lib/content-data";

export const Route = createFileRoute("/blog/")({
  loader: async () => loadBlogIndex(),
  head: () => blogIndexHead(),
  component: BlogIndex,
});

function BlogIndex() {
  const { posts } = Route.useLoaderData();
  return (
    <PageShell>
      <BlogIndexView posts={posts} />
    </PageShell>
  );
}
