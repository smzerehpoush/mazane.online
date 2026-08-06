/**
 * مسیر تخت ‎/<slug>‎ — صفحه‌ی دارایی یا صفحه‌ی سکو (بلیت ۷؛ بند ۱۳،
 * تصمیم‌های ۱۰، ۱۱ و ۱۹).
 *
 * حل اسلاگ با داده‌ی جدول مرکزی گردآورنده است (`lib/slugs.ts`): اسلاگ دارایی
 * ⟸ صفحه‌ی دارایی؛ اسلاگ سکو ⟸ صفحه‌ی سکو؛ ناشناخته، رزروشده، یا دارایی با
 * دروازه‌ی انتشار بسته ⟸ ۴۰۴.
 *
 * کلمات رزرو (blog، go، api، sitemap.xml، robots.txt، _next، about) و صفحات
 * ایستای ریشه هرگز به اینجا نمی‌رسند: مسیرهای ایستای روتر بر مسیر داینامیک
 * مقدم‌اند، و `isReservedSlug` هم جدا ردشان می‌کند (دفاع در عمق — حتی اگر
 * روزی payload آلوده اسلاگ «blog» را ادعا کند).
 *
 * این فایل فقط سیم‌کشی است؛ نما و سرصفحه در
 * `components/content/SlugPageView.tsx` اند تا بدون بستر روتر تست شوند.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundPanel } from "@/components/content/NotFoundPanel";
import { PageShell } from "@/components/content/PageShell";
import { SlugPageView, slugHead } from "@/components/content/SlugPageView";
import { loadSlugPage } from "@/lib/content-data";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const data = await loadSlugPage({ data: { slug: params.slug } });
    if (data === null) throw notFound();
    return data;
  },
  head: ({ loaderData }) => slugHead(loaderData),
  component: SlugPage,
  notFoundComponent: () => (
    <PageShell>
      <NotFoundPanel />
    </PageShell>
  ),
});

function SlugPage() {
  return (
    <PageShell wide>
      <SlugPageView data={Route.useLoaderData()} />
    </PageShell>
  );
}
