/**
 * کارت‌های منبع قیمت (بند ۶ سند طراحی).
 *
 * ⚠️ **بج درصد اختلاف ندارد** (بند ۱۵، تصمیم ۳). طرح اولیه روی هر کارت
 * غیرمرجع `−۱٫۲۳٪` می‌گذاشت؛ آن عدد حذف شد و نه اینجا محاسبه می‌شود نه جای
 * دیگر. تنها بج باقی‌مانده «قیمت مرجع» است که یک **برچسب** است نه عدد.
 *
 * ⚠️ قاعده‌ی سخت ۷: هر کارت به ‎/go/<slug>‎ می‌رود با
 * ‎rel="sponsored nofollow noopener"‎ و ‎target="_blank"‎ — هرگز مستقیم به
 * دامنه‌ی سکو. مقصد در `dashboard.ts` ساخته می‌شود و نگهبان CI دارد.
 *
 * اسپارک‌لاین SVG دستی است و مسیرش **سمت سرور** تولید شده
 * (`lib/spline.ts::seriesPaths`)، پس در همان HTML اولیه است و با جاوااسکریپت
 * خاموش هم دیده می‌شود. `aria-hidden` است چون همان اطلاعات به‌صورت متنی
 * (قیمت کنارش) موجود است — بند ۱۲.
 */
import type { RailSource } from "@/lib/dashboard";

export function SourceCards({ sources }: { sources: RailSource[] }) {
  return (
    <section className="card-surface overflow-hidden px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-[15.5px] font-semibold">منابع قیمت</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">روند ۲۴ ساعت گذشته‌ی هر سکو</p>
      </div>

      {/*
        گرید با `auto-fit` و کمینه‌ی ۱۳۰px بسته شده، نه `repeat(5, …)` ثابت:
        شمار منابع را پنل تعیین می‌کند و بین ۲ تا ۶ است (بند ۱۵، تصمیم ۲)،
        پس ستون ثابت یا شکاف می‌داد یا سرریز.
      */}
      <div className="mt-3.5 grid grid-cols-2 gap-[11px] sm:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        {sources.map((source) => (
          <a
            key={source.slug}
            href={source.href}
            rel="sponsored nofollow noopener"
            target="_blank"
            data-outbound="source-card"
            data-source-card={source.slug}
            className="transition-smooth block rounded-[11px] border border-transparent bg-surface p-3 pb-2.5 text-inherit no-underline hover:border-line2"
          >
            <span className="mb-2 flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: source.color }}
              />
              <span className="truncate text-xs text-muted-foreground">{source.name}</span>
            </span>

            <div data-source-price className="num text-base font-semibold tracking-[-0.3px]">
              {source.priceDisplay ?? (
                <span className="text-[12.5px] font-normal text-muted-foreground">
                  قیمت در دسترس نیست
                </span>
              )}
            </div>

            {/* جای بج همیشه اشغال است تا ارتفاع کارت‌ها یکی بماند (بند ۶). */}
            <span className="my-1.5 mb-2.5 flex h-[18px] items-center">
              {source.isReference && (
                <span className="rounded-[20px] bg-acbg px-[7px] py-px text-[10.5px] text-actx">
                  قیمت مرجع
                </span>
              )}
            </span>

            {source.sparkline.line === null ? (
              /* بند ۱۱: بدون تاریخچه، جای خالی حفظ می‌شود و خطی رسم نمی‌شود. */
              <div aria-hidden className="h-7 w-full" />
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 100 32"
                preserveAspectRatio="none"
                className="block h-7 w-full"
              >
                <path d={source.sparkline.area ?? ""} fill={source.color} fillOpacity=".1" />
                <path
                  d={source.sparkline.line}
                  fill="none"
                  stroke={source.color}
                  strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
