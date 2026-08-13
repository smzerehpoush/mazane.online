/**
 * ⚠️ **بج درصد اختلاف ندارد**. طرح اولیه روی هر کارت
 * غیرمرجع `−۱٫۲۳٪` می‌گذاشت؛ آن عدد حذف شد و نه اینجا محاسبه می‌شود نه جای
 * دیگر. تنها بج باقی‌مانده «قیمت مرجع» است که یک **برچسب** است نه عدد.
 * ⚠️ هر کارت به ‎/go/<slug>‎ می‌رود با
 * ‎rel="sponsored nofollow noopener"‎ و ‎target="_blank"‎ — هرگز مستقیم به
 * دامنه‌ی سکو. مقصد در `dashboard.ts` ساخته می‌شود و نگهبان CI دارد.
 */
import { Staleness } from "@/components/content/RowParts";
import type { RailSource } from "@/lib/dashboard";

export function SourceCards({ sources, nowMs }: { sources: RailSource[]; nowMs: number }) {
  return (
    <section className="card-surface overflow-hidden px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-[15.5px] font-semibold">منابع قیمت</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">روند ۲۴ ساعت گذشته‌ی هر سکو</p>
      </div>

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

            <span className="my-1.5 mb-2.5 flex h-[18px] items-center">
              {source.isReference && (
                <span className="rounded-[20px] bg-acbg px-[7px] py-px text-[10.5px] text-actx">
                  قیمت مرجع
                </span>
              )}
            </span>

            {/*
             * ⚠️ برچسب کهنگیِ **هر سکو** — نه سطح صفحه. برچسب بالای محور
             * بیشینه‌ی زمان همه‌ی سکوهاست، پس یک سکوی مرده پشت تازگیِ بقیه
             * پنهان می‌ماند؛ جدول قدیمی این را به‌ازای هر ردیف داشت و با
             * حذفش گم شده بود.
             * `nowMs` از `generated_at` سرور می‌آید نه `Date.now`، پس
             * هیدریشن واگرا نمی‌شود.
             */}
            <div className="mb-1.5 text-[10px]">
              <Staleness updatedAt={source.updatedAt} nowMs={nowMs} />
            </div>

            {source.sparkline.line === null ? (
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
