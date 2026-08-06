/**
 * سایت‌مپ — بلیت ۱۲ (بلاگ) + بلیت ۷ (صفحات دارایی و سکو).
 *
 * قاعده‌ی بند ۶.۷ سند معماری: `lastmod` فقط با تغییر معنادار محتوا —
 *   - پست بلاگ: `updated_at` خود پست (که فقط با ویرایش واقعی عوض می‌شود).
 *   - صفحه‌ی اصلی و صفحات دارایی/سکو: اصلاً `lastModified` ندارند؛ نوسان
 *     قیمت «تغییر محتوا» نیست و «تغییر معنادار» (افزوده شدن سکو/دارایی)
 *     فعلاً ردیابی نمی‌شود — حذفِ صادقانه بهتر از now() دروغین است که
 *     اعتماد گوگل به lastmod کل سایت را می‌سوزاند.
 *
 * دروازه‌ی انتشار (بند ۱۳، تصمیم ۱۰): فقط دارایی‌های published در سایت‌مپ
 * می‌آیند — دارایی تک‌سکویی همان‌طور که 404 است از سایت‌مپ هم غایب است.
 * فهرست سکوها از قبل در گردآورنده فیلتر شده (فقط قابل نمایش‌ها).
 *
 * پیش‌نویس و پس‌گرفته هرگز اینجا نمی‌آیند (listPublishedPosts فقط منتشرشده‌ها
 * را می‌دهد). با revalidate شدن ‎/sitemap.xml‎ از مسیر /api/revalidate-blog،
 * انتشار و پس‌گیری بدون دیپلوی در سایت‌مپ منعکس می‌شود.
 */
import type { MetadataRoute } from "next";

import { listPublishedPosts } from "../lib/blog";
import { getInstruments, getListedPlatforms } from "../lib/prices";
import { SITE_URL } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, instruments, platforms] = await Promise.all([
    listPublishedPosts(),
    getInstruments(),
    getListedPlatforms(),
  ]);

  return [
    { url: `${SITE_URL}/` },
    // معیارهای پیشنهاد سردبیر (بلیت ۶) — ایستا؛ lastmod فقط با ویرایش واقعی
    // معنا دارد که ردیابی نمی‌شود، پس مثل صفحه‌ی اصلی حذف شده است.
    { url: `${SITE_URL}/darbare-pishnahad` },
    // «مظنه چیست» (بلیت ۱۰؛ بند ۱۱) — ایستا؛ به همان دلیل بدون lastmod.
    { url: `${SITE_URL}/mazane-chist` },
    // صفحات دارایی — فقط دروازه‌ی انتشار گذشته‌ها (تصمیم ۱۰)؛ بدون lastmod.
    ...instruments
      .filter((item) => item.published)
      .map((item) => ({ url: `${SITE_URL}/${item.slug}` })),
    // صفحات سکو — فهرست از قبل فیلترشده‌ی گردآورنده؛ بدون lastmod.
    ...platforms.map((platform) => ({ url: `${SITE_URL}/${platform.slug}` })),
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updated_at,
    })),
  ];
}
