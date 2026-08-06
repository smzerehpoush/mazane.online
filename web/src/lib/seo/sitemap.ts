/**
 * سایت‌مپ — انتخاب نشانی‌ها و ساخت XML. هر دو تابع **خالص**اند تا مسیر
 * ‎src/routes/sitemap[.]xml.ts‎ فقط سه خواندن از منبع داده باشد و قواعد زیر
 * مستقیماً تست شوند.
 *
 * قاعده‌ی ‎lastmod‎ (بند ۶.۷ سند معماری): `lastmod` فقط با تغییر **معنادار**
 * محتوا جابه‌جا می‌شود.
 *   - پست بلاگ: `updated_at` خود پست (فقط با ویرایش واقعی عوض می‌شود).
 *   - صفحه‌ی اصلی، صفحات دارایی/سکو و صفحات ثابت: اصلاً `lastmod` ندارند.
 *     نوسان قیمت «تغییر محتوا» نیست، و «تغییر معنادار» (افزوده شدن سکو یا
 *     دارایی) امروز ردیابی نمی‌شود — حذفِ صادقانه بهتر از `now()` دروغین است
 *     که اعتماد گوگل به `lastmod` کل سایت را می‌سوزاند.
 *
 * دروازه‌ی انتشار (بند ۱۳، تصمیم ۱۰): فقط دارایی‌های `published` می‌آیند —
 * دارایی تک‌سکویی همان‌طور که ۴۰۴ است، از سایت‌مپ هم غایب است. فهرست سکوها
 * از قبل در گردآورنده فیلتر شده (فقط قابل نمایش‌ها).
 *
 * ورودی‌ها را مسیر ‎routes/sitemap[.]xml.ts‎ می‌خواند و آنجاست که قاعده‌ی
 * قطعی منبع اعمال می‌شود: سکو و دارایی کف ایستا دارند (`lib/registry.ts`)
 * پس هرگز نمی‌افتند؛ ولی پست‌ها ندارند و قطع پستگرس آنجا ۵۰۳ می‌شود، نه
 * سایت‌مپِ ناقصِ ۲۰۰. این تابع خودش هیچ نظری درباره‌ی قطعی ندارد — هرچه
 * بگیرد، همان را می‌سازد.
 *
 * ‎/go/‎ **هرگز** در سایت‌مپ نمی‌آید (بند ۶.۴): در robots.txt بسته است و
 * نشانی بسته در سایت‌مپ، تعارض صریح با خزنده است.
 *
 * پیش‌نویس و پس‌گرفته هرگز نمی‌آیند — `listPublishedPosts` فقط منتشرشده‌ها
 * را می‌دهد.
 */
import type { PublishedPost } from "../blog";
import type { InstrumentListing, ListedPlatform } from "../prices";
import { SITE_URL } from "../site";

export interface SitemapEntry {
  /** مسیر نسبی با اسلش آغازین — ارقام و حروف لاتین (قراردادها، بخش استک). */
  path: string;
  /** ISO-8601؛ نبودش یعنی «تغییر معنادار ردیابی نمی‌شود» (بند ۶.۷). */
  lastModified?: string;
}

/** صفحات ثابتِ همیشه‌موجود — آینه‌ی `STATIC_PAGE_SLUGS` در `lib/slugs.ts`. */
const STATIC_PATHS: readonly string[] = [
  "/",
  "/blog",
  "/mazane-chist",
  "/darbare-pishnahad",
];

export interface SitemapInput {
  posts: readonly PublishedPost[];
  instruments: readonly InstrumentListing[];
  platforms: readonly ListedPlatform[];
}

/**
 * فهرست نشانی‌های عمومی، به همان ترتیبی که در XML می‌آیند: صفحات ثابت،
 * صفحات دارایی منتشرشده، صفحات سکو، سپس پست‌های بلاگ.
 */
export function buildSitemapEntries(input: SitemapInput): SitemapEntry[] {
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...input.instruments
      .filter((item) => item.published)
      .map((item) => ({ path: `/${item.slug}` })),
    ...input.platforms.map((platform) => ({ path: `/${platform.slug}` })),
    ...input.posts.map((post) => ({
      path: `/blog/${post.slug}`,
      lastModified: post.updated_at,
    })),
  ];
}

/** فرار XML — اسلاگ‌ها لاتین و تخت‌اند، ولی نشانی هرگز بی‌فرار داخل XML نمی‌رود. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapXml(
  entries: readonly SitemapEntry[],
  siteUrl: string = SITE_URL,
): string {
  const urls = entries.map((entry) => {
    const loc = `    <loc>${escapeXml(`${siteUrl}${entry.path}`)}</loc>`;
    const lastmod =
      entry.lastModified === undefined
        ? ""
        : `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`;
    return `  <url>\n${loc}${lastmod}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
