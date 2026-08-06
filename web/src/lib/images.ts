/**
 * عکس شاخص پست — لایه‌ی دامنه (بلیت ۲۴).
 *
 * آینه‌ی `lib/views.ts`/`lib/admin-posts.ts`: منبع تزریق‌پذیر است و این
 * ماژول **هرگز** خودش `@aws-sdk/client-s3` یا `sharp` را import نمی‌کند —
 * `server/image-store.ts` کارخانه‌اش را ثبت می‌کند (همان قاعده‌ی باندل: هیچ
 * وابستگی نودی در گراف کلاینت).
 *
 * ⚠️ تفاوت آگاهانه با نثر تیکت: امضای `ImageStore.upload` یک آرگومان `slug`
 * هم می‌گیرد (اول)، نه فقط `(bytes, contentType)`. دلیل: نام‌گذاری شیء طبق
 * طراحی `posts/<slug>/<hash>.webp` است و خودِ استور یک بوکت/کلاینت مشترک
 * است، دقیقاً همان دلیلی که `ViewCounterSource.recordView(slug)` و
 * `AdminPostsSource.getPost(slug)` کلید را به متد می‌دهند نه به کارخانه.
 *
 * چرا `source()` مثل `views.ts` خطا را قورت نمی‌دهد بلکه مثل `admin-posts.ts`
 * پرتاب می‌کند: این مسیر یک نوشتنِ پنل است نه خواندنِ صفحه‌ی عمومی — قاعده‌ی
 * ۵ («قطع منبع = کهنگی نه خطا») فقط صفحه‌ی عمومی را می‌گیرد. قطع انبار عکس
 * باید آپلود را با پیام روشن رد کند، نه بی‌صدا هیچ‌کاری نکند.
 */

/** شکل نهایی عکس روی پست — همان چیزی که BlogPostView رندر می‌کند. */
export interface ImageAsset {
  url: string;
  alt: string;
  width: number;
  height: number;
}

/** خروجی خام یک آپلود موفق — پیش از ساخت نشانی عمومی از objectKey. */
export interface UploadedImage {
  objectKey: string;
  width: number;
  height: number;
}

export interface ImageStore {
  /**
   * بایت‌های خام عکس (پیش از پردازش) را می‌گیرد؛ پیاده‌سازی واقعی خودش
   * کوچک‌سازی/تبدیل‌قالب را انجام می‌دهد و ابعادِ *پس از پردازش* را برمی‌گرداند.
   */
  upload(slug: string, bytes: Uint8Array, contentType: string): Promise<UploadedImage>;
}

export type ImageStoreFactory = () => ImageStore;

let activeStore: ImageStore | null = null;
let defaultFactory: ImageStoreFactory | null = null;

/** تزریق منبع — در تست‌ها فِیک درون‌حافظه‌ای، در صورت نیاز در اجرا هم. */
export function setImageStore(store: ImageStore): void {
  activeStore = store;
}

/** ثبت سازنده‌ی پیش‌فرض (S3 واقعی) — تنبل، تا اولین آپلود ساخته نمی‌شود. */
export function setDefaultImageStore(factory: ImageStoreFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetImageStore(): void {
  activeStore = null;
}

function source(): ImageStore {
  if (activeStore !== null) return activeStore;
  if (defaultFactory === null) {
    throw new Error(
      "هیچ ImageStore ثبت نشده — از «@/lib/server/image-store» بخوان یا setImageStore صدا بزن",
    );
  }
  activeStore = defaultFactory();
  return activeStore;
}

/** تنها درِ ورود به انبار عکس. شکست را بالا می‌فرستد — نقطه‌ی تماس تصمیم می‌گیرد چه پاسخی بدهد. */
export async function uploadImage(
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<UploadedImage> {
  return source().upload(slug, bytes, contentType);
}

/**
 * شکل نمایشیِ عکس یک پست — چهار ستون `posts.image_*` یا هر چهارتا پرند یا
 * هیچ‌کدام (همان قیدی که مهاجرت ۰۱۶ روی دیتابیس هم می‌بندد). تابعی خالص،
 * مصرفش هم `BlogPostView` است هم داده‌ی ساخت‌یافته‌ی آینده.
 */
export function postImageAsset(post: {
  image_url?: string | null;
  image_alt?: string | null;
  image_width?: number | null;
  image_height?: number | null;
}): ImageAsset | null {
  const url = post.image_url ?? null;
  const alt = post.image_alt ?? null;
  const width = post.image_width ?? null;
  const height = post.image_height ?? null;
  if (url === null || alt === null || width === null || height === null) return null;
  return { url, alt, width, height };
}
