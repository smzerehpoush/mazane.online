/**
 * صفحه‌ی اصلی — سروررندر؛ فقط می‌خوانَد و قالب می‌کند.
 *
 * اعداد از قبل در گردآورنده «مؤثر» شده‌اند (کارمزد لحاظ شده)؛ اینجا هیچ
 * فرمولی نیست. برچسب «آخرین به‌روزرسانی» داخل خود HTML است (<time datetime>)
 * — الزام بند ۶.۲ سند معماری. قطع منبع ⟸ کهنگی، نه خطا: صفحه همیشه رندر
 * می‌شود.
 *
 * یادداشت: استراتژی ISR ۶۰ ثانیه + به‌روزرسان کلاینت (تصمیم ۱۳) در بلیت‌های
 * بعدی می‌آید؛ گلوله‌ی رهیاب رندر پویا دارد.
 */
import { formatDateTimeFa, formatToman } from "../lib/format";
import { getPlatformSnapshot, getUpdatedAt, type Quote } from "../lib/prices";

export const dynamic = "force-dynamic";

const WALLGOLD_SLUG = "wallgold";

function findQuote(quotes: Quote[], side: Quote["side"]): Quote | null {
  return quotes.find((q) => q.side === side && q.instrument === "GOLD_18K") ?? null;
}

export default async function Home() {
  const [snapshot, updatedAt] = await Promise.all([
    getPlatformSnapshot(WALLGOLD_SLUG),
    getUpdatedAt(WALLGOLD_SLUG),
  ]);

  const buy = snapshot ? findQuote(snapshot.quotes, "BUY") : null;
  const sell = snapshot ? findQuote(snapshot.quotes, "SELL") : null;

  return (
    <main>
      <h1>مظنه آنلاین</h1>
      <p>قیمت مؤثر خرید و فروش طلای آب‌شده — با احتساب کارمزد، نه قیمت اسمی.</p>

      <section aria-labelledby="wallgold-heading">
        <h2 id="wallgold-heading">وال‌گلد — طلای ۱۸ عیار (تومان بر گرم)</h2>

        {buy && sell ? (
          <dl>
            <dt>قیمت مؤثر خرید (می‌پردازید)</dt>
            <dd>{formatToman(buy.price_toman)} تومان</dd>
            <dt>قیمت مؤثر فروش (می‌گیرید)</dt>
            <dd>{formatToman(sell.price_toman)} تومان</dd>
          </dl>
        ) : (
          <p>قیمت جاری در دسترس نیست.</p>
        )}

        <p>
          آخرین به‌روزرسانی:{" "}
          {updatedAt ? (
            <time dateTime={updatedAt}>{formatDateTimeFa(updatedAt)}</time>
          ) : (
            <span>هنوز داده‌ای ثبت نشده است</span>
          )}
        </p>
      </section>
    </main>
  );
}
