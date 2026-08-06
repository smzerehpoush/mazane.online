/**
 * ماژول دسترسی به داده‌ی بلاگ — تنها راه لایه‌ی وب برای خواندن پست‌ها (بلیت ۱۲).
 *
 * تصمیم قالب بدنه: **مارک‌داون** (زیرمجموعه‌ی محدود)، نه HTML خام.
 * رندر امن در `lib/markdown.tsx` انجام می‌شود — خروجی عنصر React است و هیچ
 * dangerouslySetInnerHTML روی متن پست نیست، پس HTML داخل بدنه همیشه escape می‌شود.
 *
 * آینه‌ی `lib/prices.ts`: تست‌ها با `setBlogSource` فیک seed شده تزریق می‌کنند؛
 * در اجرا پیش‌فرضِ تنبل پستگرس است (`pg-blog-source.ts`) که فقط وقتی هیچ منبعی
 * تزریق نشده با import پویا load می‌شود — پس در تست‌ها `pg` اصلاً load نمی‌شود.
 *
 * منبع، پست را با هر وضعیتی برمی‌گرداند؛ قاعده‌ی نمایش — فقط `published`؛
 * پیش‌نویس/پس‌گرفته ⟸ 404 و غایب از فهرست و سایت‌مپ — همین‌جا اعمال می‌شود تا
 * مرز تست وب همین رفتار را بسنجد، نه فیک را.
 */

export type PostStatus = "draft" | "published" | "retracted";

export interface BlogPost {
  /** لاتین و تخت زیر فضای رزروشده‌ی ‎/blog/‎ (بند ۱۳، تصمیم ۱۱). */
  slug: string;
  title_fa: string;
  /** مارک‌داون — زیرمجموعه‌ی مستند در lib/markdown.tsx. */
  body_md: string;
  status: PostStatus;
  /** ISO-8601 — پیش‌نویس هنوز ندارد. */
  published_at: string | null;
  /**
   * ISO-8601 — فقط با تغییر معنادار محتوا عوض می‌شود؛ منبع lastmod
   * سایت‌مپ است (بند ۶.۷ — هرگز now() نیست).
   */
  updated_at: string;
}

/** پست منتشرشده — تنها شکلی که رندر می‌شود؛ published_at قطعاً دارد. */
export interface PublishedPost extends BlogPost {
  status: "published";
  published_at: string;
}

export interface BlogSource {
  /** همه‌ی پست‌ها با هر وضعیتی؛ فیلتر نمایش با همین ماژول است. */
  listPosts(): Promise<BlogPost[]>;
  getPost(slug: string): Promise<BlogPost | null>;
}

let activeSource: BlogSource | null = null;

/** تزریق منبع داده — در تست‌ها فیک seed شده، در صورت نیاز در اجرا هم. */
export function setBlogSource(source: BlogSource): void {
  activeSource = source;
}

async function source(): Promise<BlogSource> {
  if (activeSource === null) {
    // import پویا تا در تست‌ها (که منبع تزریق می‌شود) pg اصلاً load نشود.
    const { createPgBlogSource } = await import("./pg-blog-source");
    activeSource = createPgBlogSource();
  }
  return activeSource;
}

function isPublished(post: BlogPost): post is PublishedPost {
  return post.status === "published" && post.published_at !== null;
}

/**
 * پست‌های منتشرشده، نو به کهنه (بر اساس published_at).
 *
 * استور از دسترس خارج ⟸ فهرست خالی، نه خطا (قاعده‌ی ۵ قراردادها). این حالت
 * طراحی‌شده است، نه فقط دفاعی: build بیرون از سرور انجام می‌شود (بند ۱۳،
 * تصمیم ۵) و به پستگرس دسترسی ندارد — پوسته‌ی خالی build می‌شود و صف انتشار
 * (بلیت ۱۳) با POST /api/revalidate-blog روی خود سرور پُرش می‌کند.
 */
export async function listPublishedPosts(): Promise<PublishedPost[]> {
  let posts: BlogPost[];
  try {
    posts = await (await source()).listPosts();
  } catch (error) {
    console.error("blog source unavailable; rendering empty list", error);
    return [];
  }
  return posts
    .filter(isPublished)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

/**
 * پست منتشرشده با این اسلاگ — پیش‌نویس/پس‌گرفته/ناموجود ⟸ null (صفحه 404 می‌دهد).
 *
 * برخلاف فهرست، خطای استور اینجا قورت داده *نمی‌شود*: null یعنی «قطعاً نیست»
 * و 404 می‌شود؛ اگر خطای گذرا 404 جا زده شود گوگل صفحه را از ایندکس می‌اندازد.
 * خطا بالا می‌رود (۵۰۰ کش‌نشدنی)؛ نسخه‌ی ایستای قبلی صفحه سر جایش می‌ماند.
 */
export async function getPublishedPost(slug: string): Promise<PublishedPost | null> {
  const post = await (await source()).getPost(slug);
  if (post === null || !isPublished(post)) return null;
  return post;
}
