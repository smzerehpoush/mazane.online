/**
 * ویرایش/ساخت پست در پنل مدیریت — لایه‌ی دامنه (بلیت ۲۲).
 *
 * آینه‌ی `lib/views.ts`/`lib/platform-settings.ts`: منبع تزریق‌پذیر است و این
 * ماژول **هرگز** خودش `pg` را import نمی‌کند — `server/admin-posts.ts`
 * کارخانه‌اش را ثبت می‌کند (همان قاعده‌ی باندل: هیچ ماژول نودی در گراف کلاینت).
 *
 * چرا از `BlogSource` (`lib/blog.ts`) جدا است: آن ماژول طبق کامنت بالای
 * خودش فقط خواندنی است. پنل برای نوشتن یک منبع تازه لازم دارد، نه دست‌کاری
 * ماژولی که مرز خواندن عمومی/سایت‌مپ را می‌سنجد.
 *
 * ⚠️ قاعده‌ی سخت ۵ این مخزن: `posts.updated_at` فقط با تغییر معنادار محتوا و
 * تیک صریح کاربر جلو می‌رود؛ هرگز با `now()` خودکار یا موقع ذخیره‌ی پیش‌نویس.
 * `nextUpdatedAt` همین قاعده را به شکل یک تابع خالص پیاده می‌کند — خودش
 * وضعیت پست را نمی‌داند و نباید بداند؛ تصمیم «پیش‌نویس هرگز جلو نمی‌رود»
 * مسئولیت نقطه‌ی فراخوانی (`updatePost` در همین فایل) است: برای پیش‌نویس
 * همیشه `meaningfulEdit=false` محاسبه می‌شود، هرچه کلاینت فرستاده باشد —
 * هرگز به کلاینت اعتماد نمی‌کنیم.
 */

import type { BlogPost, PostStatus } from "./blog";

/** همان شکل اسلاگ که مهاجرت ۰۱۰ روی جدول `posts` قید کرده. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export interface CreatePostInput {
  slug: string;
  title_fa: string;
  body_md: string;
}

export interface UpdatePostInput {
  title_fa: string;
  body_md: string;
  /** تیک صریح «این ویرایش معنادار بود» — فقط برای پست منتشرشده اثر دارد. */
  meaningfulEdit: boolean;
}

/**
 * خروجی هر عملیات نوشتن. `kind` تفکیک HTTP را ممکن می‌کند (۴۰۴ در برابر
 * ۴۰۰) بدون اینکه لایه‌ی HTTP مجبور شود متن پیام فارسی را پارس کند.
 */
export type WriteFailure = { ok: false; kind: "not_found" | "invalid"; error: string };
export type WriteResult = { ok: true; post: BlogPost } | WriteFailure;

/** عکس شاخصِ پردازش‌شده — همیشه هر چهار فیلد با هم (بند طراحی بلیت ۲۴). */
export interface PostImagePatch {
  image_url: string;
  image_alt: string;
  image_width: number;
  image_height: number;
}

export interface AdminPostsSource {
  /** همه‌ی پست‌ها با هر وضعیتی — برای فهرست پنل. */
  listPosts(): Promise<BlogPost[]>;
  getPost(slug: string): Promise<BlogPost | null>;
  insertPost(post: BlogPost): Promise<void>;
  updatePost(
    slug: string,
    patch: { title_fa: string; body_md: string; updated_at: string },
  ): Promise<void>;
  setStatus(
    slug: string,
    patch: { status: PostStatus; published_at: string | null; updated_at: string },
  ): Promise<void>;
  /** عکس شاخص را روی همین رکورد پست می‌نشاند — مسیری کاملاً جدا از updatePost. */
  setImage(slug: string, patch: PostImagePatch): Promise<void>;
}

export type AdminPostsFactory = () => AdminPostsSource;

let activeSource: AdminPostsSource | null = null;
let defaultFactory: AdminPostsFactory | null = null;

/** تزریق منبع — در تست‌ها فیک درون‌حافظه‌ای، در صورت نیاز در اجرا هم. */
export function setAdminPostsSource(source: AdminPostsSource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی پیش‌فرض (پستگرس) — تنبل، تا اولین نوشتن ساخته نمی‌شود. */
export function setDefaultAdminPostsSource(factory: AdminPostsFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetAdminPostsSource(): void {
  activeSource = null;
}

function source(): AdminPostsSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "هیچ AdminPostsSource ثبت نشده — از «@/lib/server/admin-posts» بخوان یا setAdminPostsSource صدا بزن",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

/**
 * قاعده‌ی جلو رفتن `updated_at` (بند ۵ قراردادها): فقط با
 * `meaningfulEdit===true` جلو می‌رود؛ در غیر این صورت `current` دست‌نخورده
 * برمی‌گردد. تابعی خالص و مستقل‌تست — بدون دسترسی به منبع، بدون دانستن
 * وضعیت پست.
 */
export function nextUpdatedAt(current: string, meaningfulEdit: boolean, now: string): string {
  return meaningfulEdit ? now : current;
}

function invalid(error: string): WriteFailure {
  return { ok: false, kind: "invalid", error };
}

function notFoundFailure(): WriteFailure {
  return { ok: false, kind: "not_found", error: "پست پیدا نشد" };
}

function validateTitleAndBody(title_fa: string, body_md: string): string | null {
  if (title_fa.trim() === "") return "عنوان نمی‌تواند خالی باشد";
  if (body_md.trim() === "") return "متن نمی‌تواند خالی باشد";
  return null;
}

/** همه‌ی پست‌ها با هر وضعیتی — فهرست پنل. */
export async function listAllPosts(): Promise<BlogPost[]> {
  return source().listPosts();
}

/** یک پست با هر وضعیتی — برای صفحه‌ی ویرایش پنل. */
export async function getAdminPost(slug: string): Promise<BlogPost | null> {
  return source().getPost(slug);
}

/**
 * ساخت پست تازه — همیشه `draft`. اسلاگ باید همان شکل جدول را داشته باشد و
 * پیش از insert باید بررسی شود تکراری نباشد (پیام خطای روشن، نه خطای خام
 * دیتابیس) — رقابت هم‌زمان روی همان اسلاگ را محدودیت PK جدول در
 * `server/admin-posts.ts` می‌گیرد.
 */
export async function createPost(input: CreatePostInput, now: string): Promise<WriteResult> {
  if (!isValidSlug(input.slug)) {
    return invalid("اسلاگ باید فقط حروف لاتین کوچک، رقم و خط‌تیره‌ی میانی باشد");
  }
  const fieldError = validateTitleAndBody(input.title_fa, input.body_md);
  if (fieldError !== null) return invalid(fieldError);

  const src = source();
  const existing = await src.getPost(input.slug);
  if (existing !== null) return invalid("این اسلاگ قبلاً استفاده شده است");

  const post: BlogPost = {
    slug: input.slug,
    title_fa: input.title_fa,
    body_md: input.body_md,
    status: "draft",
    published_at: null,
    updated_at: now,
    image_url: null,
    image_alt: null,
    image_width: null,
    image_height: null,
  };
  await src.insertPost(post);
  return { ok: true, post };
}

/**
 * ویرایش عنوان/متن. قاعده‌ی `updated_at`: پیش‌نویس هرگز جلو نمی‌رود (چون
 * اصلاً در سایت‌مپ نیست، مالک آزادانه می‌نویسد و ذخیره می‌کند)؛ پست
 * منتشرشده فقط با `meaningfulEdit===true` جلو می‌رود.
 */
export async function updatePost(
  slug: string,
  input: UpdatePostInput,
  now: string,
): Promise<WriteResult> {
  const fieldError = validateTitleAndBody(input.title_fa, input.body_md);
  if (fieldError !== null) return invalid(fieldError);

  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();

  // پیش‌نویس همیشه false — حتی اگر کلاینت meaningfulEdit=true فرستاده باشد.
  const meaningful = existing.status === "published" && input.meaningfulEdit === true;
  const updated_at = nextUpdatedAt(existing.updated_at, meaningful, now);

  await src.updatePost(slug, { title_fa: input.title_fa, body_md: input.body_md, updated_at });
  return {
    ok: true,
    post: { ...existing, title_fa: input.title_fa, body_md: input.body_md, updated_at },
  };
}

/**
 * انتشار — از `draft` یا `retracted`. `published_at` اگر خالی بود `now`
 * می‌گیرد (پست پیش‌ازاین‌پس‌گرفته‌شده تاریخ انتشار اولش را حفظ می‌کند).
 * `updated_at` همیشه جلو می‌رود — این خودش یک تغییر معنادار واقعی است.
 */
export async function publishPost(slug: string, now: string): Promise<WriteResult> {
  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();
  if (existing.status === "published") return invalid("پست از قبل منتشر شده است");

  const published_at = existing.published_at ?? now;
  const updated_at = now;
  await src.setStatus(slug, { status: "published", published_at, updated_at });
  return { ok: true, post: { ...existing, status: "published", published_at, updated_at } };
}

/**
 * پس‌گیری — فقط از `published`. `updated_at` دست‌نخورده می‌ماند: پس‌گیری
 * تغییر معنادار *محتوا* نیست، و صفحه‌ی عمومی/سایت‌مپ همین‌که `status` عوض
 * شود دیگر این پست را نشان نمی‌دهند (قاعده‌ی نمایش در `lib/blog.ts`).
 */
export async function retractPost(slug: string): Promise<WriteResult> {
  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();
  if (existing.status !== "published") return invalid("فقط پست منتشرشده را می‌توان پس گرفت");

  await src.setStatus(slug, {
    status: "retracted",
    published_at: existing.published_at,
    updated_at: existing.updated_at,
  });
  return { ok: true, post: { ...existing, status: "retracted" } };
}

/**
 * نشاندن عکس شاخصِ پردازش‌شده روی یک پست (بلیت ۲۴). مسیری کاملاً جدا از
 * `updatePost`: قطع انبار عکس هرگز به اینجا نمی‌رسد (route جداست) و این
 * تابع هم هرگز عنوان/متن را دست نمی‌زند.
 *
 * ⚠️ `updated_at` دست‌نخورده می‌ماند — عوض‌شدنش قاعده‌ی صریح «تیک ویرایش
 * معنادار» است (بند ۵ قراردادها) که اینجا موضوعیت ندارد؛ همان قاعده‌ای که
 * `retractPost` هم رعایت می‌کند.
 *
 * متن جایگزین اجباری است — دفاع اول همین‌جا؛ مهاجرت ۰۱۶ همان قاعده را
 * به‌عنوان دفاع دوم روی خودِ دیتابیس هم می‌بندد.
 */
export async function setPostImage(slug: string, image: PostImagePatch): Promise<WriteResult> {
  if (image.image_alt.trim() === "") return invalid("متن جایگزین عکس نمی‌تواند خالی باشد");
  if (image.image_width <= 0 || image.image_height <= 0) {
    return invalid("ابعاد عکس نامعتبر است");
  }

  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();

  await src.setImage(slug, image);
  return { ok: true, post: { ...existing, ...image } };
}
