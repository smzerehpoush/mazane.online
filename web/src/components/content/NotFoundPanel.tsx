/**
 * بدنه‌ی «پیدا نشد» صفحات محتوا.
 *
 * پست پس‌گرفته یا پیش‌نویس، و دارایی‌ای که دروازه‌ی انتشارش بسته است، همگی از
 * راه ۴۰۴ از ایندکس بیرون می‌روند
 * (`collector/src/tablo_collector/content/retract.py`). خودِ کد ۴۰۴ برای
 * گوگل کافی است؛ متای صریح `noindex` دفاع در عمق است و در **سرصفحه‌ی همان
 * مسیر** نشسته (شاخه‌ی `loaderData === undefined` در `head`) — یک منبع، جای
 * قطعی در `<head>`، بدون تکیه بر بالابردن خودکار تگ‌ها توسط ری‌اکت.
 */
export function NotFoundPanel({
  title = "صفحه پیدا نشد",
  note = "نشانی‌ای که خواستید وجود ندارد، منتشر نشده یا پس گرفته شده است.",
}: {
  title?: string;
  note?: string;
}) {
  return (
    <>
      <div className="glass-surface px-6 py-14 text-center">
        <p className="text-5xl font-bold text-foreground/80">۴۰۴</p>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{note}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a
            href="/"
            className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            جدول مقایسه‌ی قیمت‌ها
          </a>
          <a
            href="/blog"
            className="transition-smooth inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-surface"
          >
            بلاگ
          </a>
        </div>
      </div>
    </>
  );
}
