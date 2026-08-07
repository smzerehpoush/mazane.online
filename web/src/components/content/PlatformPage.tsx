/**
 * صفحه‌ی سکو (بلیت ۷؛ بند ۱۳، تصمیم ۴): شرایط تجاری با منبع، تحویل فیزیکی،
 * هویت حقوقی، لینک وب‌سایت و قیمت‌های همین سکو برای هر دارایی‌ای که عرضه
 * می‌کند.
 *
 * فراداده (website_url، legal_entity، delivery_note_fa، min_order_toman) همان
 * است که گردآورنده از سند تحقیق ۰۱ پر کرده؛ جای نامستند صادقانه «ثبت نشده
 * است» می‌گوید — **هیچ مقداری حدس زده نمی‌شود**. اعداد همه آماده‌ی
 * گردآورنده‌اند (قاعده‌ی ۱).
 *
 * قطع منبع ⟸ صفحه ۲۰۰ می‌ماند و فقط «قیمت در دسترس نیست» می‌گوید (قاعده‌ی ۵).
 */
import type { ReactNode } from "react";

import { Madde5Bar } from "@/components/content/LegalNotice";
import { PlatformRateCard } from "@/components/content/PlatformRateCard";
import {
  ClosedBadges,
  FeeSourceLabel,
  MarketModelBadge,
  Staleness,
} from "@/components/content/RowParts";
import { formatPercentPointsFa, formatToman } from "@/lib/format";
import type { PlatformHistory } from "@/lib/history";
import type { ListedPlatform, PlatformSnapshot } from "@/lib/prices";
import { findQuote, referencePriceFor, type Row } from "@/lib/rows";

const NOT_RECORDED = "ثبت نشده است";
const UNKNOWN = "نامشخص";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] leading-6">{children}</dd>
    </div>
  );
}

function TermsSection({ snapshot }: { snapshot: PlatformSnapshot }) {
  const { terms } = snapshot;
  const minOrder = terms.min_order_toman ?? null;
  return (
    <section aria-labelledby="terms-heading" className="glass-surface px-5 py-5 sm:px-6">
      <h2 id="terms-heading" className="text-base font-semibold sm:text-lg">
        شرایط تجاری
      </h2>
      <dl className="mt-3">
        <Field label="کارمزد خرید">
          {terms.buy_fee_percent === null
            ? UNKNOWN
            : formatPercentPointsFa(terms.buy_fee_percent)}
        </Field>
        <Field label="کارمزد فروش">
          {terms.sell_fee_percent === null
            ? UNKNOWN
            : formatPercentPointsFa(terms.sell_fee_percent)}
        </Field>
        <Field label="هزینه‌ی رفت‌وبرگشت">
          {terms.round_trip_percent === null
            ? UNKNOWN
            : formatPercentPointsFa(terms.round_trip_percent)}
        </Field>
        <Field label="منبع کارمزد">
          <FeeSourceLabel terms={terms} />
        </Field>
        <Field label="حداقل سفارش">
          <span data-min-order>
            {minOrder === null ? NOT_RECORDED : `${formatToman(Number(minOrder))} تومان`}
          </span>
        </Field>
      </dl>
    </section>
  );
}

/**
 * قیمت‌های همین سکو، دارایی به دارایی — از اسنپ‌شات خودش. قیمت مرجع همان
 * عدد آماده‌ی گردآورنده است (تصمیم ۱۹)؛ نبودش «—» می‌شود، نه عدد جعلی.
 */
function QuotesSection({
  row,
  snapshot,
  updatedAt,
  instrumentNames,
  nowMs,
}: {
  /** همان ردیف دامنه — تا انتخاب «قیمت مرجع سکو» از `lib/rows.ts` بیاید. */
  row: Row;
  snapshot: PlatformSnapshot;
  updatedAt: string | null;
  instrumentNames: Record<string, string>;
  nowMs: number;
}) {
  const codes = [...new Set(snapshot.quotes.map((q) => q.instrument))];
  const cell = "px-3 py-3 text-xs tabular-nums sm:text-sm";
  const headCell = "px-3 py-3 text-right font-medium";

  return (
    <section
      aria-labelledby="quotes-heading"
      className="glass-surface mt-6 overflow-hidden"
    >
      <div className="border-b border-border/70 px-4 py-4 sm:px-6">
        <h2 id="quotes-heading" className="text-base font-semibold sm:text-lg">
          قیمت‌های این سکو
        </h2>
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-right">
          <thead>
            <tr className="bg-surface text-[11px] text-muted-foreground sm:text-xs">
              <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
                دارایی
              </th>
              <th scope="col" className={headCell}>
                مؤثر خرید (می‌پردازید)
              </th>
              <th scope="col" className={headCell}>
                مؤثر فروش (می‌گیرید)
              </th>
              <th scope="col" className={headCell}>
                قیمت اسمی
              </th>
              <th scope="col" className={headCell}>
                قیمت مرجع سکو
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
                آخرین به‌روزرسانی
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => {
              const buy = findQuote(snapshot.quotes, "BUY", code);
              const sell = findQuote(snapshot.quotes, "SELL", code);
              const mid = findQuote(snapshot.quotes, "MID", code);
              // انتخاب، نه محاسبه: قاعده‌ی «قیمت مرجع سکو» یک‌جا در rows.ts است.
              const reference = referencePriceFor(row, code);
              return (
                <tr
                  key={code}
                  data-instrument={code}
                  className="transition-smooth border-t border-border/70 hover:bg-surface"
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-right text-xs font-medium sm:px-6 sm:text-sm"
                  >
                    {instrumentNames[code] ?? code}
                  </th>
                  <td className={cell}>
                    {buy === null ? "—" : `${formatToman(buy.price_toman)} تومان`}
                  </td>
                  <td className={cell}>
                    {sell === null ? "—" : `${formatToman(sell.price_toman)} تومان`}
                  </td>
                  <td className={cell}>
                    {mid === null ? "—" : `${formatToman(mid.price_toman)} تومان`}
                  </td>
                  <td data-reference-price className={cell}>
                    {reference === null ? "—" : `${formatToman(reference)} تومان`}
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <Staleness updatedAt={updatedAt} nowMs={nowMs} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlatformPage({
  platform,
  snapshot,
  updatedAt,
  hasOutbound,
  instrumentNames,
  history,
  nowMs,
}: {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
  hasOutbound: boolean;
  instrumentNames: Record<string, string>;
  /** تاریخچه‌ی همین سکو — کارت نرخ بالای صفحه (بلیت ۲۷). `null` یعنی بی‌سابقه. */
  history: PlatformHistory | null;
  nowMs: number;
}) {
  // ردیف دامنه‌ی همین سکو — تنها مصرفش انتخاب «قیمت مرجع سکو» است.
  const row: Row = { platform, snapshot, updatedAt };

  return (
    <>
      <header className="mb-6">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
          {platform.name_fa}
          {platform.name_en ? (
            <span className="text-sm font-normal text-muted-foreground">
              ({platform.name_en})
            </span>
          ) : null}
          <MarketModelBadge platform={platform} />
          {snapshot === null ? null : <ClosedBadges terms={snapshot.terms} />}
        </h1>
        <p className="mt-2">
          <Staleness updatedAt={updatedAt} nowMs={nowMs} />
        </p>
        {!hasOutbound ? null : (
          <p className="mt-4">
            {/* بلیت ۹ (تصمیم ۲۱): هر کلیک خروجی درآمدزا از ‎/go/<slug>‎ می‌گذرد —
                کد معرف فقط سمت ریدایرکت است و هرگز در HTML نمی‌نشیند. rel کامل
                الزام بند ۶.۴ است و تست CI دارد. */}
            <a
              href={`/go/${platform.slug}`}
              rel="sponsored nofollow noopener"
              target="_blank"
              data-outbound="website"
              className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              وب‌سایت {platform.name_fa}
            </a>
          </p>
        )}
      </header>

      {/* بلیت ۲۷: عدد درشت خودش وقتی قیمت مرجع نداریم (کارت null برمی‌گرداند)
          چیزی نمی‌گذارد؛ پیام «قیمت در دسترس نیست» زیرش همچنان می‌آید. */}
      <PlatformRateCard row={row} history={history} />

      {snapshot === null ? (
        // قطع منبع ⟸ کهنگی، نه خطا: صفحه ۲۰۰ می‌ماند (قاعده‌ی ۵ قراردادها).
        <p className="glass-surface px-5 py-8 text-center text-sm text-muted-foreground">
          قیمت در دسترس نیست
        </p>
      ) : (
        <>
          <TermsSection snapshot={snapshot} />
          <QuotesSection
            row={row}
            snapshot={snapshot}
            updatedAt={updatedAt}
            instrumentNames={instrumentNames}
            nowMs={nowMs}
          />
        </>
      )}

      <section
        aria-labelledby="identity-heading"
        className="glass-surface mt-6 px-5 py-5 sm:px-6"
      >
        <h2 id="identity-heading" className="text-base font-semibold sm:text-lg">
          هویت و تحویل فیزیکی
        </h2>
        <dl className="mt-3">
          <Field label="هویت حقوقی">
            <span data-legal-entity>{platform.legal_entity ?? NOT_RECORDED}</span>
          </Field>
          <Field label="تحویل فیزیکی">
            <span data-delivery-note>{platform.delivery_note_fa ?? NOT_RECORDED}</span>
          </Field>
        </dl>
      </section>

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به جدول مقایسه
        </a>
      </p>

      {/* بند ۷.۲: صفحه‌ی ارجاع است (لینک /go/ بالای صفحه) ⟸ نوار ماده ۵. */}
      <Madde5Bar />
    </>
  );
}
