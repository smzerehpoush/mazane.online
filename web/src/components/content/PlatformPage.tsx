import type { ReactNode } from "react";

import { Madde5Bar } from "@/components/content/LegalNotice";
import { PlatformCalculator } from "@/components/content/PlatformCalculator";
import { PlatformRateCard } from "@/components/content/PlatformRateCard";
import {
  ClosedBadges,
  FeeSourceLabel,
  MarketModelBadge,
  Staleness,
} from "@/components/content/RowParts";
import { formatDateTimeFa, formatDateFa, formatPercentPointsFa, formatToman } from "@/lib/format";
import type { PlatformHistoryByRange } from "@/lib/history";
import type { ListedPlatform, PlatformSnapshot } from "@/lib/prices";
import type { ReferencePrice } from "@/lib/reference-price";
import { priceToman, type Row } from "@/lib/rows";

const NOT_RECORDED = "ثبت نشده است";
const UNKNOWN = "نامشخص";

const PRICE_EXPLANATION_FA =
  "این عدد قیمت اعلامی همین سکوست، پیش از کارمزد. آنچه می‌پردازید یا می‌گیرید، به کارمزد خرید و فروش زیر بستگی دارد.";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] leading-6">{children}</dd>
    </div>
  );
}

function PriceCard({ toman }: { toman: number | null }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-4">
      <p className="text-[11px] text-muted-foreground">قیمت هر گرم (پیش از کارمزد)</p>
      <p data-price className="mt-1 text-lg font-bold tabular-nums sm:text-xl">
        {toman === null ? "—" : `${formatToman(toman)} تومان`}
      </p>
    </div>
  );
}

/** ⚠️ This reference figure never enters any calculation and is never shown as a platform's price. */
function UnionRateBar({ referencePrice }: { referencePrice: ReferencePrice | null }) {
  if (referencePrice === null) return null;
  return (
    <p
      data-union-rate
      className="glass-surface mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-[12px]"
    >
      <span className="text-muted-foreground">نرخ اتحادیه (۱۸ عیار)</span>
      <span className="flex items-center gap-2 font-semibold tabular-nums">
        {formatToman(referencePrice.value)} تومان
        <time dateTime={referencePrice.read_at} className="font-normal text-muted-foreground">
          {formatDateTimeFa(referencePrice.read_at)}
        </time>
      </span>
    </p>
  );
}

function TermsSection({
  row,
  snapshot,
  updatedAt,
}: {
  row: Row;
  snapshot: PlatformSnapshot;
  updatedAt: string | null;
}) {
  const { terms } = snapshot;
  const price = priceToman(row);
  const minOrder = terms.min_order_toman ?? null;
  const dateLabel = updatedAt === null ? null : formatDateFa(updatedAt);

  return (
    <section aria-labelledby="terms-heading" className="glass-surface px-5 py-5 sm:px-6">
      <h2 id="terms-heading" className="text-base font-semibold sm:text-lg">
        قیمت امروز{dateLabel === null ? null : ` — ${dateLabel}`}
      </h2>

      <div className="mt-4">
        <PriceCard toman={price} />
      </div>

      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">
        {PRICE_EXPLANATION_FA}
      </p>

      <dl className="mt-3">
        <Field label="کارمزد خرید">
          {terms.buy_fee_percent === null ? UNKNOWN : formatPercentPointsFa(terms.buy_fee_percent)}
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

export function PlatformPage({
  platform,
  snapshot,
  updatedAt,
  hasOutbound,
  instrumentNames,
  history,
  referencePrice,
  nowMs,
}: {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
  hasOutbound: boolean;
  instrumentNames: Record<string, string>;
  history: PlatformHistoryByRange;
  referencePrice: ReferencePrice | null;
  nowMs: number;
}) {
  const row: Row = { platform, snapshot, updatedAt };

  return (
    <>
      <div className="grid gap-6 mb-6 lg:mb-0 lg:grid-cols-2 lg:items-start">
        <header className="order-2 lg:order-none">
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
              <a
                href={`/go/${platform.slug}`}
                rel="sponsored nofollow noopener"
                target="_blank"
                data-outbound="website"
                className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                ورود و شروع معامله
              </a>
            </p>
          )}
        </header>

        <div className="order-1 lg:order-none">
          <PlatformRateCard row={row} history={history} nowMs={nowMs} />
        </div>
      </div>

      <UnionRateBar referencePrice={referencePrice} />

      {snapshot === null ? (
        <p className="glass-surface px-5 py-8 text-center text-sm text-muted-foreground">
          قیمت در دسترس نیست
        </p>
      ) : (
        <TermsSection row={row} snapshot={snapshot} updatedAt={updatedAt} />
      )}

      <PlatformCalculator row={row} hasOutbound={hasOutbound} />

      <section aria-labelledby="identity-heading" className="glass-surface mt-6 px-5 py-5 sm:px-6">
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

      <Madde5Bar />
    </>
  );
}
