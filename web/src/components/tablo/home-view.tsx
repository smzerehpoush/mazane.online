/**
 * انتخاب‌های نمایشی بلاگ در صفحه‌ی اصلی.
 *
 * ⚠️ این ماژول قبلاً `chartView` و `tableView` هم داشت — نمای نمودار خطی و
 * جدول مقایسه. هر دو با بازطراحی داشبورد حذف شدند (بند ۱.۱ سند طراحی:
 * «جدول ممنوع»)؛ جایشان `lib/dashboard.ts` است که نمای محور و کارت‌ها را
 * **سمت سرور** می‌سازد. آنچه اینجا ماند فقط سه کمک‌کار بلاگ است که هیچ ربطی
 * به قیمت ندارند.
 *
 * ⚠️ قاعده‌ی سخت ۱: هیچ فرمول قیمتی اینجا نیست — و اصلاً هیچ قیمتی اینجا نیست.
 */
import type { PublishedPost } from "@/lib/blog";
import { byPopularity, type ViewCounts } from "@/lib/views";

/**
 * چکیده‌ی نمایشی پست — نخستین پاراگرافِ متنیِ بدنه‌ی مارک‌داون، بدون نشانه‌های
 * نحوی. هیچ متنی ساخته نمی‌شود؛ فقط برش همان بدنه است.
 */
export function postExcerpt(bodyMd: string, maxChars = 130): string {
  const paragraph =
    bodyMd
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find((block) => block !== "" && !block.startsWith("#") && !block.startsWith("-")) ?? "";
  const plain = paragraph
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length <= maxChars ? plain : `${plain.slice(0, maxChars).trimEnd()}…`;
}

/** تازه‌ترین پست‌ها برای ستون کناری — `posts` از قبل نو به کهنه مرتب است. */
export function sidebarPosts(posts: PublishedPost[]): PublishedPost[] {
  return posts.slice(0, 4);
}

/**
 * کارت‌های انتهای صفحه — پرخواننده‌ترین‌ها، وقتی داده‌ای هست.
 *
 * `byPopularity` تا وقتی هیچ پستی بازدید ثبت‌شده ندارد ترتیب ورودی (تاریخ) را
 * دست‌نخورده برمی‌گرداند، پس روز اول هیچ ادعای جعلی «پرخواننده» گفته نمی‌شود
 * و عدد بازدید هم هرگز نمایش داده نمی‌شود — فقط ترتیب.
 */
export function bottomPosts(posts: PublishedPost[], counts: ViewCounts = {}): PublishedPost[] {
  return byPopularity(posts, counts).slice(0, 3);
}
