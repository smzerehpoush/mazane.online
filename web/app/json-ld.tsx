/**
 * تگ اسکریپت JSON-LD — تکه‌ی مشترک همه‌ی صفحه‌ها (بلیت ۱۰؛ بند ۶.۵).
 *
 * ورودی، رشته‌ی از قبل سریال‌شده‌ی lib/structured-data.ts است (که < را
 * escape کرده)؛ این کامپوننت فقط در **همان رندر سرور** تگ را می‌نشاند —
 * JSON-LD هرگز سمت کلاینت ساخته یا تازه نمی‌شود تا با HTML کهنه‌ی ISR
 * یک‌عدد بماند.
 */
export function JsonLdScript({ json }: { json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
