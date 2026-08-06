/**
 * صفحه‌ی دارایی — «هر دارایی فقط یک صفحه دارد» (بند ۱۳، تصمیم ۱۹).
 *
 * جدول هر سکوی پشتیبان را با **سه عدد آماده‌ی گردآورنده** نشان می‌دهد: مؤثر
 * خرید، مؤثر فروش، و قیمت مرجع همان سکو. هیچ فرمولی اینجا نیست (قاعده‌ی ۱)
 * و **هیچ عدد بین‌سکویی‌ای وجود ندارد** (قاعده‌ی ۴): هر عدد به سکوی خودش
 * منتسب است.
 *
 * ترتیب همان تصمیم ۱۸: صعودی بر اساس مؤثر خرید؛ سکوهای «کارمزد نامشخص»
 * (فقط MID) در گروه جدا بعد از معلوم‌ها — قیمت میانی با مؤثرها هم‌مقایسه
 * نیست و قیمت مرجع هم برایشان جعل نمی‌شود. منبع قطع ⟸ ردیف با برچسب کهنگی،
 * نه خطا (قاعده‌ی ۵).
 */
import { Madde5Bar } from "@/components/content/LegalNotice";
import { ClosedBadges, MarketModelBadge, Staleness } from "@/components/content/RowParts";
import { formatToman } from "@/lib/format";
import type { InstrumentListing } from "@/lib/prices";
import {
  effectiveBuyFor,
  effectiveSellFor,
  hasUnknownFee,
  midFor,
  referencePriceFor,
  type Row,
} from "@/lib/rows";

const COLUMN_COUNT = 5;

/**
 * ⚠️ بند ۶.۴ (قاعده‌ی مکمل): مرتب‌سازی هیچ ورودی‌ای از فیلدهای معرف سکو
 * نمی‌گیرد — فقط قیمت مؤثر/میانی گردآورنده. نگهبان CI حضور نام آن فیلدها را
 * در این فایل هم قرمز می‌کند.
 *
 * صادر شده چون سرصفحه‌ی مسیر (‎routes/$slug.tsx‎) دقیقاً همین گروه «معلوم‌ها»
 * را به `assetProductJsonLd` می‌دهد — پس عدد JSON-LD همان عدد رندرشده است،
 * بدون هیچ fetch جدا.
 */
export function groupRows(
  rows: Row[],
  instrument: string,
): { known: Row[]; unknown: Row[]; unpriced: Row[] } {
  const known = rows
    .filter((row) => !hasUnknownFee(row) && effectiveBuyFor(row, instrument) !== null)
    .sort(
      (a, b) =>
        (effectiveBuyFor(a, instrument) as number) -
        (effectiveBuyFor(b, instrument) as number),
    );
  const unknown = rows
    .filter(hasUnknownFee)
    .sort(
      (a, b) =>
        (midFor(a, instrument) ?? Number.POSITIVE_INFINITY) -
        (midFor(b, instrument) ?? Number.POSITIVE_INFINITY),
    );
  const unpriced = rows.filter(
    (row) => !hasUnknownFee(row) && effectiveBuyFor(row, instrument) === null,
  );
  return { known, unknown, unpriced };
}

const CELL = "px-3 py-3 text-xs tabular-nums sm:text-sm";
const HEAD_CELL = "px-3 py-3 text-right font-medium";

function PriceCell({ toman }: { toman: number | null }) {
  return (
    <td className={CELL}>{toman === null ? "—" : `${formatToman(toman)} تومان`}</td>
  );
}

function PlatformCell({ row }: { row: Row }) {
  return (
    <th scope="row" className="px-4 py-3 text-right font-normal sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/${row.platform.slug}`}
          className="transition-smooth text-xs font-medium hover:text-primary sm:text-sm"
        >
          {row.platform.name_fa}
        </a>
        <MarketModelBadge platform={row.platform} />
        {row.snapshot === null ? null : <ClosedBadges terms={row.snapshot.terms} />}
      </div>
    </th>
  );
}

function KnownRow({
  row,
  instrument,
  nowMs,
}: {
  row: Row;
  instrument: string;
  nowMs: number;
}) {
  const reference = referencePriceFor(row, instrument);
  return (
    <tr
      data-platform={row.platform.slug}
      className="transition-smooth border-t border-border/70 hover:bg-surface"
    >
      <PlatformCell row={row} />
      <PriceCell toman={effectiveBuyFor(row, instrument)} />
      <PriceCell toman={effectiveSellFor(row, instrument)} />
      <td data-reference-price className={CELL}>
        {reference === null ? "—" : `${formatToman(reference)} تومان`}
      </td>
      <td className="px-4 py-3 sm:px-6">
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

function UnknownFeeRow({
  row,
  instrument,
  nowMs,
}: {
  row: Row;
  instrument: string;
  nowMs: number;
}) {
  const mid = midFor(row, instrument);
  return (
    <tr
      data-platform={row.platform.slug}
      className="transition-smooth border-t border-border/70 hover:bg-surface"
    >
      <PlatformCell row={row} />
      <td colSpan={2} className={CELL}>
        {mid === null ? (
          "قیمت در دسترس نیست"
        ) : (
          <>
            {formatToman(mid)} تومان{" "}
            <span
              title="کارمزد این سکو اعلام نشده است؛ این قیمت میانیِ بدون کارمزد است و با قیمت‌های مؤثر هم‌مقایسه نیست."
              className="mid-price-note text-[11px] text-muted-foreground"
            >
              (قیمت میانی — بدون کارمزد)
            </span>
          </>
        )}
      </td>
      {/* قیمت مرجع بدون هر دو سمت مؤثر جعل نمی‌شود. */}
      <td data-reference-price className={CELL}>
        —
      </td>
      <td className="px-4 py-3 sm:px-6">
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

/** منبع قطع: قیمتی نداریم — ردیف می‌ماند و فقط کهنگی گزارش می‌شود. */
function UnpricedRow({ row, nowMs }: { row: Row; nowMs: number }) {
  return (
    <tr
      data-platform={row.platform.slug}
      className="border-t border-border/70 text-muted-foreground"
    >
      <PlatformCell row={row} />
      <td colSpan={3} className={CELL}>
        قیمت در دسترس نیست
      </td>
      <td className="px-4 py-3 sm:px-6">
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

export function AssetPage({
  listing,
  rows,
  nowMs,
}: {
  listing: InstrumentListing;
  rows: Row[];
  nowMs: number;
}) {
  const { known, unknown, unpriced } = groupRows(rows, listing.instrument);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">قیمت {listing.name_fa}</h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">
          قیمت مؤثر خرید و فروش {listing.name_fa} در سکوهای آنلاین — با احتساب کارمزد،
          نه قیمت اسمی.
          {listing.currency === "TOMAN" ? ` (تومان بر ${listing.unit_fa})` : null}
        </p>
      </header>

      <section aria-labelledby="asset-table-heading" className="glass-surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <h2 id="asset-table-heading" className="text-base font-semibold sm:text-lg">
            مقایسه‌ی سکوها
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            مرتب‌شده از ارزان‌ترین قیمت مؤثر خرید
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            هنوز داده‌ای ثبت نشده است.
          </p>
        ) : (
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-right">
              <thead>
                <tr className="bg-surface text-[11px] text-muted-foreground sm:text-xs">
                  <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
                    سکو
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    مؤثر خرید (می‌پردازید)
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    مؤثر فروش (می‌گیرید)
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    قیمت مرجع سکو
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
                    آخرین به‌روزرسانی
                  </th>
                </tr>
              </thead>
              {known.length > 0 ? (
                <tbody>
                  {known.map((row) => (
                    <KnownRow
                      key={row.platform.slug}
                      row={row}
                      instrument={listing.instrument}
                      nowMs={nowMs}
                    />
                  ))}
                </tbody>
              ) : null}
              {unknown.length > 0 ? (
                <tbody data-group="unknown-fee">
                  <tr className="border-t border-border/70 bg-surface-2/60">
                    <th
                      colSpan={COLUMN_COUNT}
                      scope="colgroup"
                      className="px-4 py-2 text-right text-[11px] font-medium text-muted-foreground sm:px-6"
                    >
                      کارمزد نامشخص — فقط قیمت میانی
                    </th>
                  </tr>
                  {unknown.map((row) => (
                    <UnknownFeeRow
                      key={row.platform.slug}
                      row={row}
                      instrument={listing.instrument}
                      nowMs={nowMs}
                    />
                  ))}
                </tbody>
              ) : null}
              {unpriced.length > 0 ? (
                <tbody>
                  {unpriced.map((row) => (
                    <UnpricedRow key={row.platform.slug} row={row} nowMs={nowMs} />
                  ))}
                </tbody>
              ) : null}
            </table>
          </div>
        )}

        <p className="page-lead border-t border-border/70 px-4 py-4 text-[11px] leading-6 text-muted-foreground sm:px-6">
          «قیمت مرجع سکو» عددی است که <strong>همان سکو</strong> را نمایندگی می‌کند —
          سکوی تک‌قیمتی همان تک‌عددش، سکوی دوقیمتی میانگین دو عدد خودش؛ مظنه آنلاین هیچ
          میانگین بین‌سکویی‌ای محاسبه یا منتشر نمی‌کند.
        </p>
      </section>

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به جدول مقایسه
        </a>
      </p>

      {/* بند ۷.۲: صفحه‌ی ارجاع است (لینک سکوها) ⟸ نوار ماده ۵. */}
      <Madde5Bar />
    </>
  );
}
