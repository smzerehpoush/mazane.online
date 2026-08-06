/**
 * صفحه‌ی سکو (بلیت ۷؛ بند ۱۳، تصمیم ۴): شرایط تجاری با منبع، تحویل
 * فیزیکی، هویت حقوقی، لینک وب‌سایت و قیمت‌های همین سکو برای هر دارایی‌ای
 * که عرضه می‌کند.
 *
 * فراداده (website_url، legal_entity، delivery_note_fa) همان است که
 * گردآورنده از سند تحقیق ۰۱ پر کرده؛ جای نامستند صادقانه «ثبت نشده»
 * می‌گوید — جعل نمی‌شود. اعداد همه آماده‌ی گردآورنده‌اند (قاعده‌ی ۱).
 */
import { formatPercentPointsFa, formatToman } from "../../lib/format";
import {
  getInstruments,
  getPlatformSnapshot,
  getUpdatedAt,
  type ListedPlatform,
  type PlatformSnapshot,
} from "../../lib/prices";
import { findQuote } from "../../lib/rows";
import { ClosedBadges, FeeSourceLabel, MarketModelBadge, Staleness } from "../row-parts";

const NOT_RECORDED = "ثبت نشده است";

function TermsSection({ snapshot }: { snapshot: PlatformSnapshot }) {
  const terms = snapshot.terms;
  const minOrder = terms.min_order_toman ?? null;
  const dtStyle = { fontWeight: 600 as const };
  return (
    <section aria-labelledby="terms-heading">
      <h2 id="terms-heading">شرایط تجاری</h2>
      <dl>
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
        <dt style={dtStyle}>منبع کارمزد</dt>
        <dd>
          <FeeSourceLabel terms={terms} />
        </dd>
        {minOrder === null ? null : (
          <>
            <dt style={dtStyle}>حداقل سفارش</dt>
            <dd>{formatToman(Number(minOrder))} تومان</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/**
 * قیمت‌های همین سکو، دارایی به دارایی — از اسنپ‌شات خودش. قیمت مرجع فقط
 * وقتی هست که گردآورنده هر دو سمت مؤثر را داشته (تصمیم ۱۹)؛ وگرنه «—».
 */
function QuotesSection({
  snapshot,
  updatedAt,
  instrumentNames,
  nowMs,
}: {
  snapshot: PlatformSnapshot;
  updatedAt: string | null;
  instrumentNames: Map<string, string>;
  nowMs: number;
}) {
  const codes = [...new Set(snapshot.quotes.map((q) => q.instrument))];
  return (
    <section aria-labelledby="quotes-heading">
      <h2 id="quotes-heading">قیمت‌های این سکو</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">دارایی</th>
            <th scope="col">مؤثر خرید (می‌پردازید)</th>
            <th scope="col">مؤثر فروش (می‌گیرید)</th>
            <th scope="col">قیمت میانی</th>
            <th scope="col">قیمت مرجع سکو</th>
            <th scope="col">آخرین به‌روزرسانی</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const buy = findQuote(snapshot.quotes, "BUY", code);
            const sell = findQuote(snapshot.quotes, "SELL", code);
            const mid = findQuote(snapshot.quotes, "MID", code);
            const reference = snapshot.reference_prices_toman?.[code] ?? null;
            return (
              <tr key={code} data-instrument={code}>
                <th scope="row">{instrumentNames.get(code) ?? code}</th>
                <td>{buy === null ? "—" : <>{formatToman(buy.price_toman)} تومان</>}</td>
                <td>{sell === null ? "—" : <>{formatToman(sell.price_toman)} تومان</>}</td>
                <td>{mid === null ? "—" : <>{formatToman(mid.price_toman)} تومان</>}</td>
                <td data-reference-price>
                  {reference === null ? "—" : <>{formatToman(reference)} تومان</>}
                </td>
                <td>
                  <Staleness updatedAt={updatedAt} nowMs={nowMs} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export async function PlatformPage({ platform }: { platform: ListedPlatform }) {
  const [snapshot, updatedAt, instruments] = await Promise.all([
    getPlatformSnapshot(platform.slug),
    getUpdatedAt(platform.slug),
    getInstruments(),
  ]);
  const nowMs = Date.now();
  const instrumentNames = new Map(
    instruments.map((item) => [item.instrument, item.name_fa]),
  );
  const websiteUrl = platform.website_url ?? null;

  return (
    <main>
      <header>
        <p>مظنه آنلاین</p>
        <h1>
          {platform.name_fa}
          {platform.name_en ? <> ({platform.name_en})</> : null}
          <MarketModelBadge platform={platform} />
          {snapshot === null ? null : <ClosedBadges terms={snapshot.terms} />}
        </h1>
        <p>
          <Staleness updatedAt={updatedAt} nowMs={nowMs} />
        </p>
        {websiteUrl === null ? null : (
          <p>
            {/* TODO(بلیت ۹): این لینک مستقیم با مسیر ‎/go/<slug>‎ (ریدایرکت با
                کد معرف مالک) جایگزین می‌شود؛ الزام rel از بند ۶.۴ همین حالا
                رعایت شده تا لینک خروجی درآمدزای بی‌rel هرگز منتشر نشود. */}
            <a href={websiteUrl} rel="sponsored nofollow noopener" data-outbound="website">
              وب‌سایت {platform.name_fa}
            </a>
          </p>
        )}
      </header>

      {snapshot === null ? (
        // قطع منبع ⟸ کهنگی، نه خطا: صفحه ۲۰۰ می‌ماند (قاعده‌ی ۵ قراردادها).
        <p>قیمت در دسترس نیست</p>
      ) : (
        <>
          <TermsSection snapshot={snapshot} />
          <QuotesSection
            snapshot={snapshot}
            updatedAt={updatedAt}
            instrumentNames={instrumentNames}
            nowMs={nowMs}
          />
        </>
      )}

      <section aria-labelledby="identity-heading">
        <h2 id="identity-heading">هویت و تحویل فیزیکی</h2>
        <dl>
          <dt style={{ fontWeight: 600 }}>هویت حقوقی</dt>
          <dd data-legal-entity>{platform.legal_entity ?? NOT_RECORDED}</dd>
          <dt style={{ fontWeight: 600 }}>تحویل فیزیکی</dt>
          <dd data-delivery-note>{platform.delivery_note_fa ?? NOT_RECORDED}</dd>
        </dl>
      </section>

      <p>
        <a href="/">بازگشت به جدول مقایسه</a>
      </p>
    </main>
  );
}
