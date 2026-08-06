/**
 * سایت‌مپ حداقلی — بلیت ۱۲؛ بلیت ۱۰ آن را گسترش می‌دهد (دارایی‌ها و سکوها).
 *
 * قاعده‌ی بند ۶.۷ سند معماری: `lastmod` فقط با تغییر معنادار محتوا —
 *   - پست بلاگ: `updated_at` خود پست (که فقط با ویرایش واقعی عوض می‌شود).
 *   - صفحه‌ی اصلی: اصلاً `lastModified` ندارد؛ نوسان قیمت «تغییر محتوا»
 *     نیست و گذاشتن now() اعتماد گوگل به lastmod کل سایت را می‌سوزاند.
 *
 * پیش‌نویس و پس‌گرفته هرگز اینجا نمی‌آیند (listPublishedPosts فقط منتشرشده‌ها
 * را می‌دهد). با revalidate شدن ‎/sitemap.xml‎ از مسیر /api/revalidate-blog،
 * انتشار و پس‌گیری بدون دیپلوی در سایت‌مپ منعکس می‌شود.
 */
import type { MetadataRoute } from "next";

import { listPublishedPosts } from "../lib/blog";
import { SITE_URL } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts();

  return [
    { url: `${SITE_URL}/` },
    // معیارهای پیشنهاد سردبیر (بلیت ۶) — ایستا؛ lastmod فقط با ویرایش واقعی
    // معنا دارد که ردیابی نمی‌شود، پس مثل صفحه‌ی اصلی حذف شده است.
    { url: `${SITE_URL}/darbare-pishnahad` },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updated_at,
    })),
  ];
}
