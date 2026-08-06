/**
 * شمارنده‌ی بازدید پست‌های بلاگ — لایه‌ی دامنه.
 *
 * آینه‌ی `lib/blog.ts` و `lib/prices.ts`: منبع تزریق‌پذیر است و این ماژول
 * **هرگز** خودش `pg` را import نمی‌کند — `server/view-counter.ts` کارخانه‌اش
 * را ثبت می‌کند (همان قاعده‌ی باندل).
 *
 * چرا منبع جداست و به `BlogSource` اضافه نشد: محتوای پست و سنجه‌ی تعامل دو
 * چیزند. `BlogSource` فقط می‌خوانَد و محتوا برمی‌گرداند؛ این یکی می‌نویسد و
 * عدد جهش‌پذیر نگه می‌دارد. جداکردنشان یعنی صفحه‌ی بلاگ بدون شمارنده هم
 * کاملاً کار می‌کند (قاعده‌ی ۵: نبود سنجه، خطا نیست).
 *
 * ⚠️ **چرا شمارش از مرورگر است نه از رندر سرور:** HTML صفحه‌ها در لبه‌ی
 * آروان کش می‌شود (بند ۶.۲). اگر در loader می‌شمردیم، فقط cache-miss ها
 * شمرده می‌شدند — عددی که بیشتر رفتار کش را توصیف می‌کند تا خواننده را، و
 * با روشن/خاموش شدن کش چند برابر جابه‌جا می‌شود.
 *
 * حریم خصوصی: هیچ کوکی، هیچ IP، هیچ شناسه‌ای ذخیره نمی‌شود — فقط یک عدد
 * تجمیعی به‌ازای اسلاگ.
 */

import type { PublishedPost } from "./blog";

/** شمار بازدید هر اسلاگ. اسلاگِ غایب یعنی «هنوز صفر»، نه خطا. */
export type ViewCounts = Readonly<Record<string, number>>;

export interface ViewCounterSource {
  /** یک بازدید برای این اسلاگ ثبت کن. اسلاگ ناشناخته را باید نادیده بگیرد. */
  recordView(slug: string): Promise<void>;
  /** شمار بازدید همه‌ی اسلاگ‌هایی که تا حالا دیده شده‌اند. */
  viewCounts(): Promise<ViewCounts>;
}

export type ViewCounterFactory = () => ViewCounterSource;

let activeSource: ViewCounterSource | null = null;
let defaultFactory: ViewCounterFactory | null = null;

/** تزریق منبع — در تست‌ها فیک، در صورت نیاز در اجرا هم. */
export function setViewCounter(source: ViewCounterSource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی پیش‌فرض (پستگرس) — تنبل، تا اولین استفاده ساخته نمی‌شود. */
export function setDefaultViewCounter(factory: ViewCounterFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetViewCounter(): void {
  activeSource = null;
}

function source(): ViewCounterSource | null {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) return null;
  activeSource = defaultFactory();
  return activeSource;
}

/**
 * ثبت یک بازدید. شکست را **قورت می‌دهد**: شمارنده هرگز نباید باعث شود
 * درخواستِ خواننده خطا بگیرد یا صفحه‌ای نرندر شود (قاعده‌ی ۵).
 * خروجی می‌گوید ثبت شد یا نه — فقط برای لاگ و تست، نه برای کاربر.
 */
export async function recordPostView(slug: string): Promise<boolean> {
  const counter = source();
  if (counter === null) return false;
  try {
    await counter.recordView(slug);
    return true;
  } catch (error) {
    console.error("view counter unavailable; view not recorded", error);
    return false;
  }
}

/**
 * شمار بازدیدها. قطع منبع ⟸ شیء تهی، نه خطا — صفحه با ترتیب تاریخ رندر
 * می‌شود و هیچ عددی جعل نمی‌شود.
 */
export async function getViewCounts(): Promise<ViewCounts> {
  const counter = source();
  if (counter === null) return {};
  try {
    return await counter.viewCounts();
  } catch (error) {
    console.error("view counter unavailable; falling back to date order", error);
    return {};
  }
}

/** آیا اصلاً داده‌ی بازدیدی داریم که ادعای «پرخواننده» را صادق کند؟ */
export function hasViewData(posts: PublishedPost[], counts: ViewCounts): boolean {
  return posts.some((post) => (counts[post.slug] ?? 0) > 0);
}

/**
 * مرتب‌سازی بر اساس بازدید، نو به کهنه برای تساوی‌ها.
 *
 * تا وقتی هیچ پستی بازدید ثبت‌شده ندارد، **ترتیب ورودی دست‌نخورده می‌ماند**
 * (که ترتیب تاریخ است) — چون «پرخواننده‌ترین» بدون داده، ادعای جعلی است.
 * همین قاعده در `home-view.tsx` عنوان بخش را هم تعیین می‌کند.
 */
export function byPopularity(posts: PublishedPost[], counts: ViewCounts): PublishedPost[] {
  if (!hasViewData(posts, counts)) return posts;
  return [...posts].sort((a, b) => {
    const diff = (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0);
    if (diff !== 0) return diff;
    return Date.parse(b.published_at) - Date.parse(a.published_at);
  });
}
