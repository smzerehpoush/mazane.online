/**
 * صفحه‌ی دارایی — «هر دارایی فقط یک صفحه دارد» (بند ۱۳، تصمیم ۱۹).
 *
 * جدول هر سکوی پشتیبان را با **سه عدد آماده‌ی گردآورنده** نشان می‌دهد:
 * مؤثر خرید، مؤثر فروش، و قیمت مرجع همان سکو (میانگین مؤثر خرید و فروش
 * خودش — کلید reference_prices_toman در payload). هیچ فرمولی اینجا نیست و
 * **هیچ عدد بین‌سکویی‌ای وجود ندارد** (قاعده‌ی ۴ قراردادها): هر میانگین به
 * سکوی خودش منتسب است.
 *
 * ترتیب همان تصمیم ۱۸: صعودی بر اساس مؤثر خرید؛ سکوهای «کارمزد نامشخص»
 * (فقط MID) در گروه جدا بعد از معلوم‌ها — قیمت میانی با مؤثرها هم‌مقایسه
 * نیست و قیمت مرجع هم برایشان جعل نمی‌شود. منبع قطع ⟸ ردیف با برچسب
 * کهنگی، نه خطا (قاعده‌ی ۵).
 *
 * اعداد ISR-فقط‌اند (حداکثر ۶۰ ثانیه کهنه) — به‌روزرسان زنده mount
 * نمی‌شود؛ انتخاب مستند در ‎app/[slug]/page.tsx‎.
 *
 * بلیت ۱۰ (بند ۶.۵): `Product` + `AggregateOffer` در **همین رندر** و از
 * **همین ردیف‌های** جدول ساخته می‌شود (گروه معلوم‌ها — بدون fetch جدا)؛
 * BreadcrumbList دارد و نوار ماده ۵ (بند ۷.۲) پایین صفحه است.
 */
import { formatToman } from "../../lib/format";
import type { InstrumentListing } from "../../lib/prices";
import {
  effectiveBuyFor,
  effectiveSellFor,
  fetchRowsForPlatforms,
  hasUnknownFee,
  midFor,
  referencePriceFor,
  type Row,
} from "../../lib/rows";
import { SITE_URL } from "../../lib/site";
import { assetProductJsonLd, breadcrumbJsonLd } from "../../lib/structured-data";
import { JsonLdScript } from "../json-ld";
import { Madde5Bar } from "../legal-notice";
import { ClosedBadges, MarketModelBadge, Staleness } from "../row-parts";

const COLUMN_COUNT = 5;

/**
 * ⚠️ بند ۶.۴ (قاعده‌ی مکمل): مرتب‌سازی هیچ ورودی‌ای از فیلدهای معرف سکو
 * (کمیسیون) نمی‌گیرد — فقط قیمت مؤثر/میانی گردآورنده؛ نگهبان CI در
 * tests/sponsored-links.test.tsx حضور نام آن فیلدها در این فایل را هم
 * قرمز می‌کند.
 */
function groupRows(
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

function PriceCell({ toman }: { toman: number | null }) {
  return <td>{toman === null ? "—" : <>{formatToman(toman)} تومان</>}</td>;
}

function KnownRow({ row, instrument, nowMs }: { row: Row; instrument: string; nowMs: number }) {
  return (
    <tr data-platform={row.platform.slug}>
      <th scope="row">
        <a href={`/${row.platform.slug}`}>{row.platform.name_fa}</a>
        <MarketModelBadge platform={row.platform} />
        {row.snapshot === null ? null : <ClosedBadges terms={row.snapshot.terms} />}
      </th>
      <PriceCell toman={effectiveBuyFor(row, instrument)} />
      <PriceCell toman={effectiveSellFor(row, instrument)} />
      <td data-reference-price>
        {referencePriceFor(row, instrument) === null ? (
          "—"
        ) : (
          <>{formatToman(referencePriceFor(row, instrument) as number)} تومان</>
        )}
      </td>
      <td>
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

function UnknownFeeRow({ row, instrument, nowMs }: { row: Row; instrument: string; nowMs: number }) {
  const mid = midFor(row, instrument);
  return (
    <tr data-platform={row.platform.slug}>
      <th scope="row">
        <a href={`/${row.platform.slug}`}>{row.platform.name_fa}</a>
        <MarketModelBadge platform={row.platform} />
        {row.snapshot === null ? null : <ClosedBadges terms={row.snapshot.terms} />}
      </th>
      <td colSpan={2}>
        {mid === null ? (
          "قیمت در دسترس نیست"
        ) : (
          <>
            {formatToman(mid)} تومان{" "}
            <span
              title="کارمزد این سکو اعلام نشده است؛ این قیمت میانیِ بدون کارمزد است و با قیمت‌های مؤثر هم‌مقایسه نیست."
              className="mid-price-note"
            >
              (قیمت میانی — بدون کارمزد)
            </span>
          </>
        )}
      </td>
      {/* قیمت مرجع بدون هر دو سمت مؤثر جعل نمی‌شود. */}
      <td data-reference-price>—</td>
      <td>
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

/** منبع قطع: قیمتی نداریم — ردیف می‌ماند و فقط کهنگی گزارش می‌شود. */
function UnpricedRow({ row, nowMs }: { row: Row; nowMs: number }) {
  return (
    <tr data-platform={row.platform.slug}>
      <th scope="row">
        <a href={`/${row.platform.slug}`}>{row.platform.name_fa}</a>
        <MarketModelBadge platform={row.platform} />
      </th>
      <td colSpan={3}>قیمت در دسترس نیست</td>
      <td>
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

export async function AssetPage({ listing }: { listing: InstrumentListing }) {
  // فقط سکوهای پشتیبان همین دارایی — به ترتیب فهرست عمومی گردآورنده.
  const rows = await fetchRowsForPlatforms(listing.supporting_platform_slugs);
  const nowMs = Date.now();
  const { known, unknown, unpriced } = groupRows(rows, listing.instrument);
  // بند ۶.۵: از همان `known` رندرشده — null یعنی بدون ردیف معلوم، هیچ
  // AggregateOffer ای جعل نمی‌شود و اسکریپت اصلاً رندر نمی‌شود.
  const productJson = assetProductJsonLd(listing, known);

  return (
    <main>
      <JsonLdScript
        json={breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: listing.name_fa, url: `${SITE_URL}/${listing.slug}` },
        ])}
      />
      {productJson === null ? null : <JsonLdScript json={productJson} />}
      <header>
        <p>مظنه آنلاین</p>
        <h1>قیمت {listing.name_fa}</h1>
        <p>
          قیمت مؤثر خرید و فروش {listing.name_fa} در سکوهای آنلاین — با احتساب
          کارمزد، نه قیمت اسمی.
          {listing.currency === "TOMAN" ? <> (تومان بر {listing.unit_fa})</> : null}
        </p>
      </header>

      <section aria-labelledby="asset-table-heading">
        <h2 id="asset-table-heading">مقایسه‌ی سکوها</h2>
        {rows.length === 0 ? (
          <p>هنوز داده‌ای ثبت نشده است.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">سکو</th>
                <th scope="col">مؤثر خرید (می‌پردازید)</th>
                <th scope="col">مؤثر فروش (می‌گیرید)</th>
                <th scope="col">قیمت مرجع سکو</th>
                <th scope="col">آخرین به‌روزرسانی</th>
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
                <tr>
                  <th colSpan={COLUMN_COUNT} scope="colgroup">
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
        )}
        <p className="page-lead">
          «قیمت مرجع سکو» میانگین قیمت مؤثر خرید و فروش <strong>همان سکو</strong>{" "}
          است؛ مظنه آنلاین هیچ میانگین بین‌سکویی‌ای محاسبه یا منتشر نمی‌کند.
        </p>
      </section>

      <p>
        <a href="/">بازگشت به جدول مقایسه</a>
      </p>

      {/* بند ۷.۲: صفحه‌ی ارجاع است (لینک سکوها) ⟸ نوار ماده ۵. */}
      <Madde5Bar />
    </main>
  );
}
