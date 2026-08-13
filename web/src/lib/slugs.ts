/**
 * ⚠️ فهرست از `lib/catalog.ts` می‌آید، نه مستقیم از استور: **هویت صفحه
 * نباید به ردیسِ زنده گره بخورد.** قطع ردیس یعنی کهنگی، پس
 * اسلاگ معتبرِ بی‌داده باید ۲۰۰ بگیرد و فقط جای قیمتش «در دسترس نیست»
 * بنویسد — نه ۴۰۴ی که لبه‌ی آروان هم کشش کند.
 */
import { listInstruments, listPlatforms } from "./catalog";
import type { InstrumentListing, ListedPlatform } from "./prices";

export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "blog",
  "go",
  "api",
  "sitemap.xml",
  "robots.txt",
  "_next",
  "about",
]);

export const STATIC_PAGE_SLUGS: ReadonlySet<string> = new Set([
  "darbare-pishnahad",
  "mazane-chist",
]);

export type SlugResolution =
  | { kind: "instrument"; listing: InstrumentListing }
  | { kind: "platform"; platform: ListedPlatform };

export function isReservedSlug(slug: string): boolean {
  return RESERVED_WORDS.has(slug) || STATIC_PAGE_SLUGS.has(slug);
}

export async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  if (isReservedSlug(slug)) return null;
  const [instruments, platforms] = await Promise.all([listInstruments(), listPlatforms()]);
  const listing = instruments.find((item) => item.slug === slug);
  if (listing !== undefined) {
    return listing.published ? { kind: "instrument", listing } : null;
  }
  const platform = platforms.find((item) => item.slug === slug);
  if (platform !== undefined) return { kind: "platform", platform };
  return null;
}
