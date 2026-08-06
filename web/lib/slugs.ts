/**
 * حل‌کننده‌ی اسلاگ تخت — پشت مسیر ‎app/[slug]‎ (بلیت ۷؛ بند ۱۳، تصمیم ۱۱).
 *
 * مالک جدول اسلاگ گردآورنده است (`collector/src/mazane_collector/slugs.py`)؛
 * این ماژول فقط داده‌ی همان جدول را که از استور می‌آید حل می‌کند:
 * اسلاگ دارایی ⟸ صفحه‌ی دارایی، اسلاگ سکو ⟸ صفحه‌ی سکو، ناشناخته ⟸ 404.
 *
 * کلمات رزرو (و صفحات ایستای سطح ریشه) هرگز نباید به این مسیر برسند —
 * مسیرهای ایستای نکست خودشان مقدم‌اند — ولی حل‌کننده به‌هرحال ردشان می‌کند
 * (دفاع در عمق: حتی اگر روزی payload آلوده اسلاگ «blog» را ادعا کند، این
 * مسیر آن را نمی‌گیرد). فهرست، آینه‌ی RESERVED_WORDS گردآورنده است.
 *
 * دروازه‌ی انتشار (تصمیم ۱۰) اینجا فقط **خوانده** می‌شود: دارایی با
 * published=false مثل ناشناخته 404 است. آستانه و شمارش در گردآورنده است.
 */
import {
  getInstruments,
  getListedPlatforms,
  type InstrumentListing,
  type ListedPlatform,
} from "./prices";

/** آینه‌ی RESERVED_WORDS جدول مرکزی گردآورنده (بند ۱۳، تصمیم ۱۱). */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "blog",
  "go",
  "api",
  "sitemap.xml",
  "robots.txt",
  "_next",
  "about",
]);

/** صفحات ایستای سطح ریشه — مسیر ایستای خودشان را دارند، نه ‎[slug]‎. */
export const STATIC_PAGE_SLUGS: ReadonlySet<string> = new Set([
  "darbare-pishnahad",
  "mazane-chist",
]);

export type SlugResolution =
  | { kind: "instrument"; listing: InstrumentListing }
  | { kind: "platform"; platform: ListedPlatform };

/** رزرو یا صفحه‌ی ایستا — هرگز از مسیر داینامیک حل نمی‌شود. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_WORDS.has(slug) || STATIC_PAGE_SLUGS.has(slug);
}

/**
 * حل اسلاگ به موجودیت — null یعنی 404 (ناشناخته، رزروشده، یا دارایی‌ای که
 * دروازه‌ی انتشارش بسته است).
 */
export async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  if (isReservedSlug(slug)) return null;
  const [instruments, platforms] = await Promise.all([
    getInstruments(),
    getListedPlatforms(),
  ]);
  const listing = instruments.find((item) => item.slug === slug);
  if (listing !== undefined) {
    // دارایی تک‌سکویی صفحه نمی‌گیرد (تصمیم ۱۰) — پرچم گردآورنده، نه شمارش وب.
    return listing.published ? { kind: "instrument", listing } : null;
  }
  const platform = platforms.find((item) => item.slug === slug);
  if (platform !== undefined) return { kind: "platform", platform };
  return null;
}
