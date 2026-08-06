/**
 * صفحه‌ی اصلی — نمای تک‌عددی (بند ۱۳، تصمیم ۱۸): «برای یک گرم طلا چقدر
 * می‌پردازی؟» سروررندر؛ فقط می‌خوانَد و قالب می‌کند.
 *
 * فهرست سکوها همان است که گردآورنده نوشته (فقط ALLOWED ها — گلدیکا و هر
 * PERMISSION_PENDING دیگر اصلاً به این لایه نمی‌رسند؛ هیچ فیلتری اینجا نیست).
 * اعداد از قبل در گردآورنده «مؤثر» شده‌اند؛ اینجا هیچ فرمول قیمتی نیست.
 * تنها حساب این صفحه دو مقایسه‌ی نمایشی خودِ تصمیم ۱۸/۹ است که جز با دیدِ
 * بین‌سکویی ممکن نیست: تفاضل هر ردیف با ارزان‌ترین (دلتا) و کمینه‌گیری
 * پیشنهاد سردبیر — هیچ قیمت یا میانگین تازه‌ای تولید نمی‌شود.
 *
 * ترتیب جدول فقط از قیمت مؤثر خرید می‌آید — هرگز از کمیسیون (بند ۶.۴).
 * سکوهای «کارمزد نامشخص» (fee_source=UNKNOWN — فقط MID دارند) بعد از همه‌ی
 * ردیف‌های معلوم در گروه جدا می‌آیند: قیمت میانی با مؤثرها هم‌مقایسه نیست.
 *
 * قطع منبع ⟸ کهنگی، نه خطا: صفحه همیشه ۲۰۰ می‌دهد و ردیف منبع قطع‌شده
 * برچسب کهنگی می‌گیرد. برچسب زمان داخل خود HTML است (<time datetime>) —
 * الزام بند ۶.۲ سند معماری.
 *
 * جزئیات هر ردیف با <details> باز می‌شود — بدون هیچ جاوااسکریپتی.
 *
 * بلیت ۸ — ISR شصت‌ثانیه‌ای + به‌روزرسان زنده (بند ۶.۲؛ تصمیم ۱۳):
 * صفحه با revalidate=60 رندر می‌شود، پس ردیس حداکثر یک بار در دقیقه خوانده
 * می‌شود و build بدون ردیس هم از مسیر «استور در دسترس نیست» (کهنگی، نه
 * خطا) سبز است. بعد از hydration، <LivePricesUpdater> هر ۳۰ ثانیه
 * ‎/api/prices‎ را می‌خواند و فقط متن گره‌های data-live (قیمت/برچسب زمان)
 * را درجا عوض می‌کند. انتخاب عمدی و مستند: ترتیب ردیف‌ها، دلتاها و
 * داده‌ی ساخت‌یافته (بلیت ۱۰) فقط با رندر ISR تازه می‌شوند — اگر
 * ارزان‌ترین سکو بین دو رندر جابه‌جا شود، ترتیب تا رندر بعدی (حداکثر ۶۰
 * ثانیه) قدیمی می‌ماند؛ بازمرتب‌سازی کلاینتی با سمانتیک ترتیبِ سروررندر
 * تناقض دارد. suppressHydrationWarning فقط روی همان گره‌های متنی است که
 * به‌روزرسان ممکن است پیش از پایان hydration عوض کرده باشد.
 */
import { Fragment } from "react";

import { AdSlot, type EditorialPick } from "./ad-slot";
import { LivePricesUpdater } from "./live-prices-updater";
import {
  formatDateFa,
  formatMinutesAgoFa,
  formatPercentFa,
  formatPercentPointsFa,
  formatToman,
  isStale,
  minutesSince,
} from "../lib/format";
import { STALE_SUFFIX_FA } from "../lib/live-update";
import {
  type ListedPlatform,
  type PlatformSnapshot,
  type PlatformTerms,
} from "../lib/prices";
import {
  effectiveBuy,
  fetchRows,
  findQuote,
  hasUnknownFee,
  midPrice,
  type Row,
} from "../lib/rows";

/**
 * ISR شصت‌ثانیه‌ای (بند ۶.۲ — تصمیم قطعی رندر). force-dynamic برداشته شد؛
 * درخواستِ بعد از انقضا نسخه‌ی کهنه را فوری می‌گیرد و بازتولید در پس‌زمینه
 * انجام می‌شود — هیچ خزنده/کاربری منتظر ردیس نمی‌ماند.
 */
export const revalidate = 60;

/**
 * سه گروه نمایش (تصمیم ۱۸): مؤثرِ معلوم‌ها صعودی؛ بعد «کارمزد نامشخص»
 * (فقط MID)؛ و آخرِ همه ردیف‌های بی‌قیمت (منبع قطع — با برچسب کهنگی).
 */
function groupRows(rows: Row[]): { known: Row[]; unknown: Row[]; unpriced: Row[] } {
  const known = rows
    .filter((row) => !hasUnknownFee(row) && effectiveBuy(row) !== null)
    .sort((a, b) => (effectiveBuy(a) as number) - (effectiveBuy(b) as number));
  const unknown = rows
    .filter(hasUnknownFee)
    .sort(
      (a, b) =>
        (midPrice(a) ?? Number.POSITIVE_INFINITY) -
        (midPrice(b) ?? Number.POSITIVE_INFINITY),
    );
  const unpriced = rows.filter(
    (row) => !hasUnknownFee(row) && effectiveBuy(row) === null,
  );
  return { known, unknown, unpriced };
}

/**
 * پیشنهاد سردبیر — دقیقاً قاعده‌ی منتشرشده در ‎/darbare-pishnahad‎:
 * کمترین round_trip_percent گردآورنده میان سکوهای fee_source=API با
 * خرید و فروش باز. فقط کمینه‌گیری روی اعداد آماده؛ هیچ محاسبه‌ی تازه‌ای نیست.
 */
function editorialPick(rows: Row[]): EditorialPick | null {
  let best: { row: Row; roundTrip: string } | null = null;
  for (const row of rows) {
    const terms = row.snapshot?.terms;
    if (
      terms === undefined ||
      terms.fee_source !== "API" ||
      !terms.buy_enabled ||
      !terms.sell_enabled ||
      terms.round_trip_percent === null
    ) {
      continue;
    }
    if (best === null || Number(terms.round_trip_percent) < Number(best.roundTrip)) {
      best = { row, roundTrip: terms.round_trip_percent };
    }
  }
  if (best === null) return null;
  return {
    slug: best.row.platform.slug,
    name_fa: best.row.platform.name_fa,
    round_trip_percent: best.roundTrip,
  };
}

/**
 * برچسب زمان داخل خود HTML (الزام بند ۶.۲) با قلاب‌های data-live برای
 * به‌روزرسان زنده (بلیت ۸). گره‌ی کهنگی همیشه هست (وقتی تازه است تهی) تا
 * سوآپ کلاینت فقط متن عوض کند، نه ساختار DOM.
 */
function Staleness({ updatedAt, nowMs }: { updatedAt: string | null; nowMs: number }) {
  if (updatedAt === null) {
    // سکوی بی‌سابقه قلاب زنده ندارد — با آمدن اولین داده، رندر بعدی ISR
    // (حداکثر ۶۰ ثانیه بعد) نشانش می‌دهد.
    return <span>هنوز داده‌ای ثبت نشده است</span>;
  }
  const minutes = minutesSince(updatedAt, nowMs);
  return (
    <>
      به‌روزرسانی:{" "}
      <time dateTime={updatedAt} data-live="updated-at" suppressHydrationWarning>
        {formatMinutesAgoFa(minutes)}
      </time>
      <strong data-live="stale" suppressHydrationWarning>
        {isStale(minutes) ? STALE_SUFFIX_FA : null}
      </strong>
    </>
  );
}

function FeeSourceLabel({ terms }: { terms: PlatformTerms }) {
  if (terms.fee_source === "MANUAL") {
    // کارمزد دستی باید برچسب و تاریخ مشاهده داشته باشد (بند ۲.۲ سند معماری).
    return (
      <span>
        دستی — مشاهده‌شده در{" "}
        <time dateTime={terms.observed_at}>{formatDateFa(terms.observed_at)}</time>
      </span>
    );
  }
  if (terms.fee_source === "UNKNOWN") {
    return <span>نامشخص — سکو کارمزدش را اعلام نکرده است</span>;
  }
  return <span>از API سکو</span>;
}

/**
 * برچسب صریح دفتر سفارش (بند ۹.۲، شکاف ۵ رقبا): قیمت داریک از سفارش‌های
 * کاربران است، نه قیمت‌گذاری فروشنده — بدون این برچسب، اسپرد ناهم‌جنس
 * به‌عنوان قیمت رقیب خوانده می‌شود.
 */
function MarketModelBadge({ platform }: { platform: ListedPlatform }) {
  if (platform.market_model !== "ORDER_BOOK") return null;
  return (
    <span
      data-badge="order-book"
      title="قیمت این سکو از دفتر سفارش کاربران می‌آید؛ ممکن است نقدشوندگی محدود باشد و اسپردش با سکوهای فروشنده هم‌جنس نیست."
      style={{
        background: "#e8eaf6",
        color: "#283593",
        borderRadius: "4px",
        padding: "1px 6px",
        marginInlineStart: "6px",
        fontSize: "0.75em",
        whiteSpace: "nowrap",
      }}
    >
      دفتر سفارش
    </span>
  );
}

/** نشان باز/بسته — از buy_enabled/sell_enabled داده‌ی زنده (بند ۹.۲). */
function ClosedBadges({ terms }: { terms: PlatformTerms }) {
  const badgeStyle = {
    background: "#c62828",
    color: "#fff",
    borderRadius: "4px",
    padding: "1px 6px",
    marginInlineStart: "6px",
    fontSize: "0.75em",
    whiteSpace: "nowrap" as const,
  };
  return (
    <>
      {terms.buy_enabled ? null : (
        <strong data-badge="buy-closed" style={badgeStyle}>
          خرید بسته است
        </strong>
      )}
      {terms.sell_enabled ? null : (
        <strong data-badge="sell-closed" style={badgeStyle}>
          فروش بسته است
        </strong>
      )}
    </>
  );
}

const COLUMN_COUNT = 4;

/** جزئیات بازشونده — progressive disclosure بدون جاوااسکریپت (<details>). */
function DetailsRow({ snapshot }: { snapshot: PlatformSnapshot }) {
  const terms = snapshot.terms;
  const unknown = terms.fee_source === "UNKNOWN";
  const sell = findQuote(snapshot.quotes, "SELL");
  const minOrder = terms.min_order_toman ?? null;
  const dtStyle = { fontWeight: 600 as const };
  return (
    <tr data-details-for={snapshot.platform_slug}>
      <td colSpan={COLUMN_COUNT} style={{ padding: "0 8px 8px" }}>
        <details>
          <summary>جزئیات کارمزد و فروش</summary>
          <dl style={{ margin: "8px 0 0" }}>
            <dt style={dtStyle}>کارمزد خرید</dt>
            <dd>
              {terms.buy_fee_percent === null
                ? "نامشخص"
                : formatPercentPointsFa(terms.buy_fee_percent)}
            </dd>
            <dt style={dtStyle}>کارمزد فروش</dt>
            <dd>
              {terms.sell_fee_percent === null
                ? "نامشخص"
                : formatPercentPointsFa(terms.sell_fee_percent)}
            </dd>
            <dt style={dtStyle}>هزینه‌ی رفت‌وبرگشت</dt>
            <dd>
              {terms.round_trip_percent === null
                ? "نامشخص"
                : formatPercentPointsFa(terms.round_trip_percent)}
            </dd>
            <dt style={dtStyle}>قیمت مؤثر فروش (می‌گیرید)</dt>
            <dd>{sell === null ? "—" : `${formatToman(sell.price_toman)} تومان`}</dd>
            {minOrder === null ? null : (
              <>
                <dt style={dtStyle}>حداقل سفارش</dt>
                <dd>{formatToman(Number(minOrder))} تومان</dd>
              </>
            )}
            <dt style={dtStyle}>منبع کارمزد</dt>
            <dd>
              {unknown ? "نامشخص — قیمت بالا میانی و بدون کارمزد است" : <FeeSourceLabel terms={terms} />}
            </dd>
          </dl>
        </details>
      </td>
    </tr>
  );
}

/**
 * دلتای نمایشی تصمیم ۱۸: تفاضل مؤثر خرید این ردیف با ارزان‌ترین، به تومان
 * و درصد. مقایسه‌ی بین‌سکویی برای نمایش است — قیمت مشتق جدیدی نیست و هرگز
 * جدا از سکوی خودش منتشر نمی‌شود (بند ۷.۱).
 */
function DeltaCell({ buy, cheapestBuy }: { buy: number; cheapestBuy: number }) {
  if (buy === cheapestBuy) {
    return (
      <td>
        {formatToman(0)} تومان <strong data-badge="cheapest">(ارزان‌ترین)</strong>
      </td>
    );
  }
  const delta = buy - cheapestBuy;
  return (
    <td>
      {formatToman(delta)} تومان ({formatPercentFa(delta / cheapestBuy)}) گران‌تر
    </td>
  );
}

function KnownRow({
  row,
  cheapestBuy,
  nowMs,
}: {
  row: Row;
  cheapestBuy: number;
  nowMs: number;
}) {
  const snapshot = row.snapshot as PlatformSnapshot;
  const buy = effectiveBuy(row) as number;
  const cheapest = buy === cheapestBuy;
  return (
    <Fragment>
      <tr
        data-platform={row.platform.slug}
        {...(cheapest ? { "data-cheapest": "true" } : {})}
        style={cheapest ? { background: "#eef7ee", fontWeight: 600 } : undefined}
      >
        <th scope="row">
          {row.platform.name_fa}
          <MarketModelBadge platform={row.platform} />
          <ClosedBadges terms={snapshot.terms} />
        </th>
        <td>
          {/* فقط خود عدد قلاب زنده دارد؛ «تومان» و دلتا مال رندر ISR اند. */}
          <span data-live="price" suppressHydrationWarning>
            {formatToman(buy)}
          </span>{" "}
          تومان
        </td>
        <DeltaCell buy={buy} cheapestBuy={cheapestBuy} />
        <td>
          <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
        </td>
      </tr>
      <DetailsRow snapshot={snapshot} />
    </Fragment>
  );
}

function UnknownFeeRow({ row, nowMs }: { row: Row; nowMs: number }) {
  const snapshot = row.snapshot as PlatformSnapshot;
  const mid = midPrice(row);
  return (
    <Fragment>
      <tr data-platform={row.platform.slug}>
        <th scope="row">
          {row.platform.name_fa}
          <MarketModelBadge platform={row.platform} />
          <ClosedBadges terms={snapshot.terms} />
        </th>
        <td>
          {mid === null ? (
            "قیمت در دسترس نیست"
          ) : (
            <>
              <span data-live="price" suppressHydrationWarning>
                {formatToman(mid)}
              </span>{" "}
              تومان{" "}
              <span
                title="کارمزد این سکو اعلام نشده است؛ این قیمت میانیِ بدون کارمزد است و با قیمت‌های مؤثر ستون بالا هم‌مقایسه نیست."
                style={{ fontSize: "0.8em", color: "#8a6d1a" }}
              >
                (قیمت میانی — بدون کارمزد)
              </span>
            </>
          )}
        </td>
        <td>—</td>
        <td>
          <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
        </td>
      </tr>
      <DetailsRow snapshot={snapshot} />
    </Fragment>
  );
}

/** منبع قطع: قیمتی نداریم — ردیف می‌ماند و فقط کهنگی گزارش می‌شود. */
function UnpricedRow({ row, nowMs }: { row: Row; nowMs: number }) {
  return (
    <tr data-platform={row.platform.slug}>
      <th scope="row">
        {row.platform.name_fa}
        <MarketModelBadge platform={row.platform} />
      </th>
      <td>قیمت در دسترس نیست</td>
      <td>—</td>
      <td>
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

export default async function Home() {
  // همان لایه‌ی مشترک ‎lib/rows.ts‎ که ‎/api/prices‎ هم می‌خواند (بلیت ۸).
  const rows: Row[] = await fetchRows();
  const nowMs = Date.now();

  const { known, unknown, unpriced } = groupRows(rows);
  const cheapestBuy = known.length > 0 ? (effectiveBuy(known[0]) as number) : null;
  const pick = editorialPick(rows);

  return (
    <main>
      <header>
        <p>مظنه آنلاین</p>
        <h1>برای یک گرم طلا چقدر می‌پردازی؟</h1>
        <p>قیمت مؤثر خرید و فروش طلای آب‌شده — با احتساب کارمزد، نه قیمت اسمی.</p>
      </header>

      <AdSlot position="top" pick={pick} />

      <section aria-labelledby="platforms-heading">
        <h2 id="platforms-heading">طلای ۱۸ عیار (تومان بر گرم)</h2>

        {rows.length === 0 ? (
          <p>هنوز داده‌ای ثبت نشده است.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">سکو</th>
                <th scope="col">برای یک گرم می‌پردازید</th>
                <th scope="col">اختلاف با ارزان‌ترین</th>
                <th scope="col">آخرین به‌روزرسانی</th>
              </tr>
            </thead>
            {known.length > 0 && cheapestBuy !== null ? (
              <tbody>
                {known.map((row) => (
                  <KnownRow
                    key={row.platform.slug}
                    row={row}
                    cheapestBuy={cheapestBuy}
                    nowMs={nowMs}
                  />
                ))}
              </tbody>
            ) : null}
            {unknown.length > 0 ? (
              <tbody data-group="unknown-fee" style={{ background: "#fdf9ef" }}>
                <tr>
                  <th
                    colSpan={COLUMN_COUNT}
                    scope="colgroup"
                    style={{ textAlign: "start", padding: "8px", borderTop: "2px solid #d8c98e" }}
                  >
                    کارمزد نامشخص — فقط قیمت میانی
                  </th>
                </tr>
                {unknown.map((row) => (
                  <UnknownFeeRow key={row.platform.slug} row={row} nowMs={nowMs} />
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
      </section>

      <AdSlot position="bottom" pick={pick} />

      {/* هیچ HTML ای ندارد — polling سی‌ثانیه‌ای بعد از hydration (بلیت ۸). */}
      <LivePricesUpdater />
    </main>
  );
}
