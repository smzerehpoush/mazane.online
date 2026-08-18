import { GoldPriceBody, GoldPriceCard } from "@/components/content/GoldPriceToday";
import { Madde5Bar } from "@/components/content/LegalNotice";
import { ClosedBadges, MarketModelBadge, Staleness } from "@/components/content/RowParts";
import { formatPercentPointsFa, formatToman } from "@/lib/format";
import { GOLD_PRICE_QUESTION, type GoldPriceView } from "@/lib/gold-price";
import type { InstrumentListing } from "@/lib/prices";
import { buyFeePercent, compareByPrice, priceToman, sellFeePercent, type Row } from "@/lib/rows";

export function groupRows(rows: Row[], instrument: string): { priced: Row[]; unpriced: Row[] } {
  const priced = rows
    .filter((row) => priceToman(row, instrument) !== null)
    .sort(compareByPrice(instrument));
  const unpriced = rows.filter((row) => priceToman(row, instrument) === null);
  return { priced, unpriced };
}

const CELL = "px-3 py-3 text-xs tabular-nums sm:text-sm";
const HEAD_CELL = "px-3 py-3 text-right font-medium";

function FeeCell({ percent }: { percent: number | null }) {
  return (
    <td data-fee className={CELL}>
      {percent === null ? "—" : formatPercentPointsFa(percent)}
    </td>
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

function PricedRow({ row, instrument, nowMs }: { row: Row; instrument: string; nowMs: number }) {
  const price = priceToman(row, instrument);
  return (
    <tr
      data-platform={row.platform.slug}
      className="transition-smooth border-t border-border/70 hover:bg-surface"
    >
      <PlatformCell row={row} />
      <td data-price className={CELL}>
        {price === null ? "—" : `${formatToman(price)} تومان`}
      </td>
      <FeeCell percent={buyFeePercent(row)} />
      <FeeCell percent={sellFeePercent(row)} />
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

const GOLD_PRICE_LEAD =
  "نرخ هر گرم طلای ۱۸ عیار به گزارش tala.ir، تغییرش در ۲۴ ساعت، هفته و ماه گذشته، و عددی که هر سکوی آنلاین برای همان یک گرم اعلام کرده است.";

export function AssetPage({
  listing,
  rows,
  nowMs,
  goldPrice = null,
}: {
  listing: InstrumentListing;
  rows: Row[];
  nowMs: number;
  goldPrice?: GoldPriceView | null;
}) {
  const { priced, unpriced } = groupRows(rows, listing.instrument);

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

      <section aria-labelledby="asset-table-heading" className="glass-surface overflow-hidden">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
          <h2 id="asset-table-heading" className="text-base font-semibold sm:text-lg">
            مقایسه‌ی سکوها
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            مرتب‌شده از ارزان‌ترین قیمت — کارمزد در ستون‌های بعدی جداست
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
                    قیمت
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    کارمزد خرید
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    کارمزد فروش
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">
                    آخرین به‌روزرسانی
                  </th>
                </tr>
              </thead>
              {priced.length > 0 ? (
                <tbody>
                  {priced.map((row) => (
                    <PricedRow
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
          ستون «قیمت» عدد اعلامی <strong>همان سکو</strong> است، پیش از کارمزد؛ سکویی که خودش دو عدد
          جدا برای خرید و فروش می‌دهد، میانگین همان دو ثبت می‌شود. کارمزد «—» یعنی سکو آن را اعلام
          نکرده، نه اینکه صفر است. تابلو هیچ میانگین بین‌سکویی‌ای محاسبه یا منتشر نمی‌کند.
        </p>
      </section>

      {goldPrice === null ? null : <GoldPriceBody />}

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به مقایسه‌ی قیمت سکوها
        </a>
      </p>

      <Madde5Bar />
    </>
  );
}
