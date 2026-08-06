/**
 * بدل next/font/google برای vitest — لودر واقعی فقط داخل بیلد نکست کار
 * می‌کند (دانلود و سلف-هاست فونت در زمان بیلد). تست‌ها فقط به className
 * نیاز دارند؛ رفتار فونت موضوع تست نیست.
 */
export function Vazirmatn(): { className: string } {
  return { className: "font-vazirmatn" };
}
