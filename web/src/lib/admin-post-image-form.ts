/**
 * اعتبارسنجی سمت کلاینت برای فرم آپلود عکس شاخص در پنل ‎/admin/posts/$slug‎
 * (بلیت ۲۴ — تکمیل UI).
 *
 * فقط تجربه‌ی سریع‌تر: همان قاعده‌ای که سرور به‌طور مستقل و قطعی اجرا
 * می‌کند («فایل غایب ⟸ ۴۰۰»، «متن جایگزین خالی ⟸ ۴۰۰» —
 * `lib/server/admin-post-image.ts`). این تابع دروازه‌ی امنیتی نیست، فقط
 * دکمه‌ی آپلود را تا وقتی ورودی ناقص است غیرفعال نگه می‌دارد.
 */
export interface PostImageFormInput {
  file: File | null;
  alt: string;
}

export function canUploadPostImage({ file, alt }: PostImageFormInput): boolean {
  return file !== null && alt.trim().length > 0;
}
