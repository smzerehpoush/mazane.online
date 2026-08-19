import { ComparisonControls } from "@/components/content/ComparisonControls";
import { GoldPriceBody, GoldPriceCard } from "@/components/content/GoldPriceToday";
import { Madde5Bar } from "@/components/content/LegalNotice";
import { RelatedLinksBlock } from "@/components/content/RelatedLinks";
import { ClosedBadges, MarketModelBadge, Staleness } from "@/components/content/RowParts";
import { relatedLinksForPath } from "@/lib/clusters";
import {
  buildComparisonModel,
  comparisonHref,
  DEFAULT_COMPARISON_VIEW,
  minOrderToman,
  SORT_LABELS_FA,
  type ComparisonModel,
  type ComparisonSort,
  type ComparisonView,
} from "@/lib/comparison-table";
import { formatFaNumber } from "@/lib/fa-number";
import { formatPercentPointsFa, formatToman } from "@/lib/format";
import { GOLD_PRICE_QUESTION, type GoldPriceView } from "@/lib/gold-price";
import type { InstrumentListing } from "@/lib/prices";
import {
  buyFeePercent,
  compareByPrice,
  priceToman,
  roundTripPercent,
  sellFeePercent,
  type Row,
} from "@/lib/rows";
import {
  FEE_UNDISCLOSED_FA,
  FEES_UNDISCLOSED_FA,
  MIN_ORDER_UNCOLLECTED_FA,
} from "@/lib/undisclosed";

/**
 * ⚠️ The JSON-LD offer list is built from this function, not from the reader's
 * filtered view: a `?filter=` URL must never change what the page claims to
 * search engines, and `slugHead` canonicalizes every variant back to `/<slug>`.
 */
export function groupRows(rows: Row[], instrument: string): { priced: Row[]; unpriced: Row[] } {
  const priced = rows
    .filter((row) => priceToman(row, instrument) !== null)
    .sort(compareByPrice(instrument));
  const unpriced = rows.filter((row) => priceToman(row, instrument) === null);
  return { priced, unpriced };
}

const PRICE_MISSING_FA = "قیمت در دسترس نیست";

const CELL = "px-3 py-3 text-xs tabular-nums sm:text-sm";
const SOFT_CELL = "px-3 py-3 text-[11px] leading-5 text-muted-foreground";
const HEAD_CELL = "px-3 py-3 text-right font-medium";

function sortedAttr(model: ComparisonModel, key: ComparisonSort) {
  return model.sort === key ? ({ "aria-sort": "ascending" as const } as const) : {};
}

function FeeCell({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <td data-fee className={SOFT_CELL}>
        {FEE_UNDISCLOSED_FA}
      </td>
    );
  }
  return (
    <td data-fee className={CELL}>
      {formatPercentPointsFa(percent)}
    </td>
  );
}

function FeeCells({ row }: { row: Row }) {
  const buy = buyFeePercent(row);
  const sell = sellFeePercent(row);
  const roundTrip = roundTripPercent(row);
  if (buy === null && sell === null && roundTrip === null) {
    return (
      <td data-fee data-fee-undisclosed colSpan={3} className={SOFT_CELL}>
        {FEES_UNDISCLOSED_FA}
      </td>
    );
  }
  return (
    <>
      <FeeCell percent={buy} />
      <FeeCell percent={sell} />
      <FeeCell percent={roundTrip} />
    </>
  );
}

function MinOrderCell({ row }: { row: Row }) {
  const value = minOrderToman(row);
  if (value === null) {
    return (
      <td data-min-order className={SOFT_CELL}>
        {MIN_ORDER_UNCOLLECTED_FA}
      </td>
    );
  }
  return (
    <td data-min-order className={CELL}>
      {formatToman(value)} تومان
    </td>
  );
}

/**
 * ⚠️ The delivery note rides along with the «تحویل فیزیکی تأییدشده» filter. The
 * chip is a boolean over `delivery_note_fa`, and the terms behind that boolean
 * are not comparable — one platform takes اجرت ساخت, another charges ۳٪, a
 * third needs ۵٫۴ گرم. Filtering on "we checked it" without printing what we
 * checked turns a wide range of costs into one tick mark.
 */
function DeliveryNote({ row }: { row: Row }) {
  const note = row.platform.delivery_note_fa ?? null;
  if (note === null) return null;
  return (
    <span data-delivery-note className="w-full text-[11px] leading-5 text-muted-foreground">
      {note}
    </span>
  );
}

function PlatformCell({ row, withDeliveryNote }: { row: Row; withDeliveryNote: boolean }) {
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
        {withDeliveryNote ? <DeliveryNote row={row} /> : null}
      </div>
    </th>
  );
}

function PricedRow({
  row,
  instrument,
  nowMs,
  withDeliveryNote,
}: {
  row: Row;
  instrument: string;
  nowMs: number;
  withDeliveryNote: boolean;
}) {
  const price = priceToman(row, instrument);
  return (
    <tr
      data-platform={row.platform.slug}
      className="transition-smooth border-t border-border/70 hover:bg-surface"
    >
      <PlatformCell row={row} withDeliveryNote={withDeliveryNote} />
      <td data-price className={CELL}>
        {price === null ? PRICE_MISSING_FA : `${formatToman(price)} تومان`}
      </td>
      <FeeCells row={row} />
      <MinOrderCell row={row} />
      <td className="px-4 py-3 sm:px-6">
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

function UnpricedRow({ row, nowMs }: { row: Row; nowMs: number }) {
  return (
    <tr
      data-platform={row.platform.slug}
      className="border-t border-border/70 text-muted-foreground"
    >
      <PlatformCell row={row} withDeliveryNote={false} />
      <td colSpan={5} className={CELL}>
        {PRICE_MISSING_FA}
      </td>
      <td className="px-4 py-3 sm:px-6">
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

const GOLD_PRICE_LEAD =
  "نرخ هر گرم طلای ۱۸ عیار به گزارش tala.ir، تغییرش در ۲۴ ساعت، هفته و ماه گذشته، و عددی که هر سکوی آنلاین برای همان یک گرم اعلام کرده است.";

function ComparisonTable({
  model,
  instrument,
  nowMs,
}: {
  model: ComparisonModel;
  instrument: string;
  nowMs: number;
}) {
  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-right">
        <thead>
          <tr className="bg-surface text-[11px] text-muted-foreground sm:text-xs">
            <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
              سکو
            </th>
            <th scope="col" className={HEAD_CELL} {...sortedAttr(model, "price")}>
              {SORT_LABELS_FA.price}
            </th>
            <th scope="col" className={HEAD_CELL} {...sortedAttr(model, "buy-fee")}>
              {SORT_LABELS_FA["buy-fee"]}
            </th>
            <th scope="col" className={HEAD_CELL} {...sortedAttr(model, "sell-fee")}>
              {SORT_LABELS_FA["sell-fee"]}
            </th>
            <th scope="col" className={HEAD_CELL} {...sortedAttr(model, "round-trip")}>
              {SORT_LABELS_FA["round-trip"]}
            </th>
            <th scope="col" className={HEAD_CELL} {...sortedAttr(model, "min-order")}>
              {SORT_LABELS_FA["min-order"]}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
              آخرین به‌روزرسانی
            </th>
          </tr>
        </thead>
        {model.visible.length > 0 ? (
          <tbody>
            {model.visible.map((row) => (
              <PricedRow
                key={row.platform.slug}
                row={row}
                instrument={instrument}
                nowMs={nowMs}
                withDeliveryNote={model.filters.includes("delivery")}
              />
            ))}
          </tbody>
        ) : null}
        {model.unpriced.length > 0 ? (
          <tbody>
            {model.unpriced.map((row) => (
              <UnpricedRow key={row.platform.slug} row={row} nowMs={nowMs} />
            ))}
          </tbody>
        ) : null}
      </table>
    </div>
  );
}

export function AssetPage({
  listing,
  rows,
  nowMs,
  goldPrice = null,
  view = DEFAULT_COMPARISON_VIEW,
  onViewChange,
}: {
  listing: InstrumentListing;
  rows: Row[];
  nowMs: number;
  goldPrice?: GoldPriceView | null;
  view?: ComparisonView;
  onViewChange?: ((next: ComparisonView) => void) | undefined;
}) {
  const model = buildComparisonModel({ rows, instrument: listing.instrument, nowMs, view });
  const path = `/${listing.slug}`;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">
          {goldPrice === null ? `قیمت ${listing.name_fa}` : GOLD_PRICE_QUESTION}
        </h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">
          {goldPrice === null ? (
            <>
              قیمت اعلامی {listing.name_fa} در سکوهای آنلاین، همراه با کارمزد خرید و فروش هر سکو —
              جدا از قیمت، نه پخته در آن.
              {listing.currency === "TOMAN" ? ` (تومان بر ${listing.unit_fa})` : null}
            </>
          ) : (
            GOLD_PRICE_LEAD
          )}
        </p>
      </header>

      {goldPrice === null ? null : (
        <div className="mb-6">
          <GoldPriceCard view={goldPrice} nowMs={nowMs} />
        </div>
      )}

      <section aria-labelledby="asset-table-heading" className="card-surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <h2 id="asset-table-heading" className="text-base font-semibold sm:text-lg">
            مقایسه‌ی سکوها
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            از کم‌ترین {SORT_LABELS_FA[model.sort]} به بیشترین. کارمزد در ستون خودش می‌آید، نه پخته
            در قیمت.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            هنوز داده‌ای ثبت نشده است.
          </p>
        ) : (
          <>
            <ComparisonControls model={model} path={path} onViewChange={onViewChange} />

            {model.visible.length === 0 && model.unpriced.length === 0 ? (
              <p data-empty-view className="px-5 py-8 text-center text-sm text-muted-foreground">
                با این فیلترها هیچ سکویی نمی‌ماند.{" "}
                <a
                  href={comparisonHref({ sort: model.sort, filters: [] }, path)}
                  rel="nofollow"
                  className="transition-smooth text-primary hover:underline"
                >
                  فیلترها را بردارید
                </a>
              </p>
            ) : (
              <ComparisonTable model={model} instrument={listing.instrument} nowMs={nowMs} />
            )}

            {model.hiddenCount === 0 ? null : (
              <p data-hidden-count className="px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
                {formatFaNumber(model.hiddenCount)} سکو با فیلترهای فعلی نمایش داده نمی‌شود.
              </p>
            )}
          </>
        )}

        <p className="page-lead border-t border-border/70 px-4 py-4 text-[11px] leading-6 text-muted-foreground sm:px-6">
          ستون «قیمت» عدد اعلامی <strong>همان سکو</strong> است، پیش از کارمزد؛ سکویی که خودش دو عدد
          جدا برای خرید و فروش می‌دهد، میانگین همان دو ثبت می‌شود. هر جا سکو عددی را اعلام نکرده،
          به‌جای خط تیره همین را می‌نویسیم که اعلام نکرده است؛ یعنی عدد را نداریم، نه اینکه صفر است.
          تابلو هیچ میانگین بین‌سکویی‌ای محاسبه یا منتشر نمی‌کند.
        </p>

        <p className="border-t border-border/70 px-4 py-4 text-[11px] leading-6 text-muted-foreground sm:px-6">
          ترتیب این جدول فقط از عددهای همین ستون‌ها می‌آید و کمیسیون در آن اثری ندارد. سکویی که عدد
          ستون فعال را اعلام نکرده باشد، همیشه پایین فهرست می‌ماند تا سکوت به‌جای ارزانی خوانده
          نشود. فیلتر «رفت‌وبرگشت میانه یا کمتر» سکوهایی را نگه می‌دارد که هزینه‌ی رفت‌وبرگشت
          اعلامی‌شان از میانه‌ی همین جدول کمتر یا برابر است، و نبودِ نشان «تحویل فیزیکی تأییدشده»
          یعنی ما هنوز آن را بررسی نکرده‌ایم، نه اینکه سکو تحویل فیزیکی ندارد؛ بودنش هم یعنی شرطش را
          ثبت کرده‌ایم، و آن شرط با فیلتر روشن کنار نام هر سکو می‌آید.
        </p>
      </section>

      {goldPrice === null ? null : <GoldPriceBody />}

      <RelatedLinksBlock
        links={relatedLinksForPath(`/${listing.slug}`)}
        className="card-surface mt-6 px-5 py-5 sm:px-6"
      />

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به مقایسه‌ی قیمت سکوها
        </a>
      </p>

      <Madde5Bar />
    </>
  );
}
