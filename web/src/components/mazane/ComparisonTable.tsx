/**
 * جدول مقایسه — همه‌ی سکوهای فهرست گردآورنده، چهار ستون (تصمیم مالک):
 * نام سکو، قیمت خرید، قیمت فروش، دکمه‌ی رفتن به سایت.
 *
 * ⚠️ هیچ محاسبه‌ی قیمتی اینجا نیست: هر دو عدد از قبل در گردآورنده «مؤثر»
 * شده‌اند و `home-view` فقط انتخابشان کرده. سکوی با کارمزد نامعلوم تنها یک
 * عدد دارد و همان در هر دو ستون می‌نشیند، بدون برچسب (تصمیم مالک).
 *
 * ⚠️ قاعده‌ی ۵ — کهنگی، نه خطا: ردیفِ منبع‌قطع‌شده حذف نمی‌شود؛ «قیمت در
 * دسترس نیست» می‌گیرد و برچسب «آخرین به‌روزرسانی» کنار نامش می‌ماند.
 *
 * ⚠️ نشان‌های «خرید بسته است» / «فروش بسته است» (بند ۹.۲): بند ۱۳ تصمیم ۱۹
 * صریح است که وضعیت باز/بسته‌ی خرید و فروش مزیت رقابتی است و روی همین
 * تک‌صفحه به‌صورت نشان می‌آید. بدون آنها ردیفِ سکوی بسته از ردیف باز
 * تشخیص‌پذیر نیست و عددش خوانده می‌شود انگار قابل معامله است. همان
 * `ClosedBadges` صفحات دارایی/سکو — یک نشان، یک قلاب ‎data-badge‎، همه‌جا.
 *
 * ⚠️ قاعده‌ی ۷ قراردادها (بند ۶.۴): دکمه‌ی خروجی درآمدزا فقط از ‎/go/<slug>‎
 * و فقط با ‎rel="sponsored nofollow noopener"‎ و ‎target="_blank"‎ — تست CI دارد.
 *
 * قلاب‌های ‎data-live‎ برای به‌روزرسان سی‌ثانیه‌ای‌اند (‎components/live-prices-updater‎):
 * فقط متن همین گره‌ها عوض می‌شود، نه ترتیب ردیف‌ها و نه داده‌ی ساخت‌یافته.
 */
import type { TableRowView } from "./home-view";
import { ClosedBadges } from "@/components/content/RowParts";
import { formatMinutesAgoFa, isStale, minutesSince } from "@/lib/format";
import { STALE_SUFFIX_FA } from "@/lib/live-update";
import { fa } from "@/lib/site-content";

/**
 * برچسب زمان داخل خودِ HTML سروررندر (الزام بند ۶.۲). گره‌ی کهنگی همیشه
 * هست — وقتی تازه است تهی — تا سوآپ کلاینت فقط متن عوض کند، نه ساختار DOM.
 *
 * `suppressHydrationWarning`: زمانِ رندر سرور و زمانِ hydration یکی نیستند و
 * ممکن است به‌روزرسان زودتر متن را عوض کرده باشد.
 */
function Staleness({ updatedAt, nowMs }: { updatedAt: string | null; nowMs: number }) {
  if (updatedAt === null) {
    return (
      <span className="text-[10px] text-muted-foreground">هنوز داده‌ای ثبت نشده است</span>
    );
  }
  const minutes = minutesSince(updatedAt, nowMs);
  return (
    <span className="text-[10px] text-muted-foreground">
      به‌روزرسانی:{" "}
      <time dateTime={updatedAt} data-live="updated-at" suppressHydrationWarning>
        {formatMinutesAgoFa(minutes)}
      </time>
      <strong data-live="stale" className="font-medium" suppressHydrationWarning>
        {isStale(minutes) ? STALE_SUFFIX_FA : null}
      </strong>
    </span>
  );
}

export function ComparisonTable({
  rows,
  nowMs,
}: {
  rows: TableRowView[];
  nowMs: number;
}) {
  return (
    <section className="glass-surface overflow-hidden">
      <div className="border-b border-border/70 px-4 py-4 sm:px-6">
        <h2 className="text-base font-semibold sm:text-lg">
          مقایسه‌ی سکوهای خرید و فروش طلا
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          مرتب‌شده از ارزان‌ترین قیمت خرید
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          هنوز داده‌ای ثبت نشده است.
        </p>
      ) : (
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-right">
            <thead>
              <tr className="bg-surface text-[11px] text-muted-foreground sm:text-xs">
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  سکو
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  قیمت خرید
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  قیمت فروش
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  <span className="sr-only">رفتن به سایت سکو</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.slug}
                  data-platform={row.slug}
                  {...(row.isBestBuy ? { "data-cheapest": "true" } : {})}
                  className="transition-smooth border-t border-border/70 hover:bg-surface"
                >
                  <td className="px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium sm:text-sm">{row.name}</span>
                      {row.isBestBuy && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                          ارزان‌ترین
                        </span>
                      )}
                      {row.isOrderBook && (
                        <span
                          data-badge="order-book"
                          title="قیمت این سکو از دفتر سفارش کاربران می‌آید؛ ممکن است نقدشوندگی محدود باشد و اسپردش با سکوهای فروشنده هم‌جنس نیست."
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          دفتر سفارش
                        </span>
                      )}
                      {row.terms === null ? null : <ClosedBadges terms={row.terms} />}
                    </div>
                    <div className="mt-1">
                      <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs tabular-nums sm:text-sm">
                    {row.buyToman === null ? (
                      <span className="text-muted-foreground">قیمت در دسترس نیست</span>
                    ) : (
                      <span data-live="price" suppressHydrationWarning>
                        {fa(row.buyToman)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground sm:text-sm">
                    {row.sellToman === null ? "—" : fa(row.sellToman)}
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <a
                      href={`/go/${row.slug}`}
                      rel="sponsored nofollow noopener"
                      target="_blank"
                      data-outbound="comparison-table"
                      className="transition-smooth inline-flex items-center justify-center rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-primary hover:border-primary/40 hover:bg-accent"
                    >
                      رفتن به سایت
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
