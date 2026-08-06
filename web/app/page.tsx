/**
 * صفحه‌ی اصلی — سروررندر؛ فقط می‌خوانَد و قالب می‌کند.
 *
 * فهرست سکوها همان است که گردآورنده نوشته (فقط ALLOWED ها — گلدیکا و هر
 * PERMISSION_PENDING دیگر اصلاً به این لایه نمی‌رسند؛ هیچ فیلتری اینجا نیست).
 * اعداد از قبل در گردآورنده «مؤثر» شده‌اند؛ اینجا هیچ فرمولی نیست — فقط
 * مرتب‌سازی صعودی بر اساس قیمت مؤثر خرید (بند ۱۳، تصمیم ۱۸).
 *
 * قطع منبع ⟸ کهنگی، نه خطا: صفحه همیشه ۲۰۰ می‌دهد و ردیف منبع قطع‌شده
 * برچسب کهنگی می‌گیرد. برچسب زمان داخل خود HTML است (<time datetime>) —
 * الزام بند ۶.۲ سند معماری.
 *
 * یادداشت: UX کامل جدول (دلتا، جزئیات بازشونده) بلیت ۶ است؛ ISR + به‌روزرسان
 * کلاینت هم بلیت‌های بعدی.
 */
import {
  formatDateFa,
  formatMinutesAgoFa,
  formatToman,
  isStale,
  minutesSince,
} from "../lib/format";
import {
  getListedPlatforms,
  getPlatformSnapshot,
  getUpdatedAt,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
} from "../lib/prices";

export const dynamic = "force-dynamic";

interface Row {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
}

function findQuote(quotes: Quote[], side: Quote["side"]): Quote | null {
  return quotes.find((q) => q.side === side && q.instrument === "GOLD_18K") ?? null;
}

function effectiveBuy(row: Row): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "BUY")?.price_toman ?? null;
}

/** مرتب‌سازی صعودی بر اساس مؤثر خرید؛ ردیف‌های بی‌قیمت (منبع قطع) ته جدول. */
function byEffectiveBuyAscending(a: Row, b: Row): number {
  return (effectiveBuy(a) ?? Number.POSITIVE_INFINITY) - (effectiveBuy(b) ?? Number.POSITIVE_INFINITY);
}

function Staleness({ updatedAt, nowMs }: { updatedAt: string | null; nowMs: number }) {
  if (updatedAt === null) {
    return <span>هنوز داده‌ای ثبت نشده است</span>;
  }
  const minutes = minutesSince(updatedAt, nowMs);
  return (
    <>
      به‌روزرسانی: <time dateTime={updatedAt}>{formatMinutesAgoFa(minutes)}</time>
      {isStale(minutes) ? <strong> (کهنه)</strong> : null}
    </>
  );
}

function FeeLabel({ snapshot }: { snapshot: PlatformSnapshot }) {
  const terms = snapshot.terms;
  if (terms.fee_source === "MANUAL") {
    // کارمزد دستی باید برچسب و تاریخ مشاهده داشته باشد (بند ۲.۲ سند معماری).
    return (
      <span>
        دستی — مشاهده‌شده در{" "}
        <time dateTime={terms.observed_at}>{formatDateFa(terms.observed_at)}</time>
      </span>
    );
  }
  return <span>از API سکو</span>;
}

function PlatformRow({ row, nowMs }: { row: Row; nowMs: number }) {
  const buy = row.snapshot ? findQuote(row.snapshot.quotes, "BUY") : null;
  const sell = row.snapshot ? findQuote(row.snapshot.quotes, "SELL") : null;

  return (
    <tr>
      <th scope="row">{row.platform.name_fa}</th>
      <td>{buy ? `${formatToman(buy.price_toman)} تومان` : "قیمت در دسترس نیست"}</td>
      <td>{sell ? `${formatToman(sell.price_toman)} تومان` : "—"}</td>
      <td>{row.snapshot ? <FeeLabel snapshot={row.snapshot} /> : "—"}</td>
      <td>
        <Staleness updatedAt={row.updatedAt} nowMs={nowMs} />
      </td>
    </tr>
  );
}

export default async function Home() {
  const platforms = await getListedPlatforms();
  const nowMs = Date.now();

  const rows: Row[] = await Promise.all(
    platforms.map(async (platform) => {
      const [snapshot, updatedAt] = await Promise.all([
        getPlatformSnapshot(platform.slug),
        getUpdatedAt(platform.slug),
      ]);
      return { platform, snapshot, updatedAt };
    }),
  );
  const sorted = [...rows].sort(byEffectiveBuyAscending);

  return (
    <main>
      <h1>مظنه آنلاین</h1>
      <p>قیمت مؤثر خرید و فروش طلای آب‌شده — با احتساب کارمزد، نه قیمت اسمی.</p>

      <section aria-labelledby="platforms-heading">
        <h2 id="platforms-heading">طلای ۱۸ عیار (تومان بر گرم)</h2>

        {sorted.length === 0 ? (
          <p>هنوز داده‌ای ثبت نشده است.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">سکو</th>
                <th scope="col">قیمت مؤثر خرید (می‌پردازید)</th>
                <th scope="col">قیمت مؤثر فروش (می‌گیرید)</th>
                <th scope="col">کارمزد</th>
                <th scope="col">آخرین به‌روزرسانی</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <PlatformRow key={row.platform.slug} row={row} nowMs={nowMs} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
