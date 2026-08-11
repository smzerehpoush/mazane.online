/**
 * منبع واقعی تاریخچه: پستگرس — دو جدول، دو دانه‌بندی.
 *
 * **فقط سمت سرور.** استخر اتصال با `blog-source.ts` مشترک است.
 *
 * برای هر سکو سطر `PRICE` را برمی‌دارد — تنها سمت موجود (سند تصمیم ۰۰۰۲).
 * ترجیح `MEAN` بر `MID` حذف شد: مهاجرت ۰۱۷ سطرهای تاریخی را هم به همین نام
 * رساند، پس چیزی برای انتخاب نمانده. `SIDE_PREFERENCE` عمداً به‌صورت فهرست
 * می‌ماند تا اگر روزی سمت تازه‌ای اضافه شد، شکل کد عوض نشود.
 *
 * هیچ محاسبه‌ای اینجا نیست (قاعده‌ی ۱): مقدار همان عددی است که گردآورنده
 * نوشته و فقط از `numeric` (رشته در درایور pg) به عدد تبدیل می‌شود.
 *
 * **نمونه‌برداری هفتگی/ماهانه (بلیت ۳۰)**: `query.stepHours` وقتی داده شود
 * (۲ برای هفتگی، ۸ برای ماهانه)، سری ساعتیِ `hourly_rollups` بعد از
 * `assemble` به سطل‌های `stepHours` ساعته نمونه‌برداری می‌شود
 * (`resampleHourlyPoints`، تابعی خالص). این مسیر دست‌نخورده می‌ماند.
 *
 * **روزانه با گام ۱۵ دقیقه از سطرهای خام (بلیت ۳۴)**: نبودِ `stepHours`
 * دیگر یعنی «بدون نمونه‌برداری» نیست — یعنی «روزانه»: پرس‌وجوی جداگانه‌ای
 * از جدول خام `quotes` (نه `hourly_rollups`، که فقط دانه‌بندی ساعتی دارد)
 * با ستون‌های هم‌نامِ `RollupRow` (با alias در SQL) تا همان `assemble` و
 * `resampleHourlyPoints` بدون تکرار کد دوباره به کار بیایند — فقط گام
 * `DAILY_STEP_HOURS` (۱۵ دقیقه) به‌جای ۲/۸ ساعت. نگه‌داری خام ۹۰روزه
 * (`collector/src/mazane_collector/retention.py::RAW_RETENTION`، بند
 * ۷.۱) پنجره‌ی ۲۴ساعته‌ی این بازه را همیشه پوشش می‌دهد؛ سکوی بی‌سابقه یا
 * پنجره‌ی بیرون از پوشش هم به سری خالی می‌رسد، نه throw (قاعده‌ی ۵ — و
 * `getPlatformHistory` در `lib/history.ts` هرحال خطای احتمالی را می‌گیرد).
 */
import "@tanstack/react-start/server-only";

import {
  getPlatformHistory as readPlatformHistory,
  setDefaultHistorySource,
  type HistoryPoint,
  type HistoryQuery,
  type HistorySource,
  type PlatformHistory,
  type ReferenceSide,
} from "../history";
import { pgPool } from "./blog-source";

interface RollupRow {
  source_slug: string;
  side: ReferenceSide;
  hour_start: Date;
  close_value: string;
}

/** ترجیح مرجع، به ترتیب. اولین سطری که برای یک سکو داده داشته باشد برنده است. */
const SIDE_PREFERENCE: readonly ReferenceSide[] = ["PRICE"];

/** گام روزانه: ۱۵ دقیقه، به ساعت (بلیت ۳۴) — واحد `resampleHourlyPoints`. */
const DAILY_STEP_MINUTES = 15;
const DAILY_STEP_HOURS = DAILY_STEP_MINUTES / 60;

const SQL = `
  select source_slug, side, hour_start, close_value
    from hourly_rollups
   where kind = 'PLATFORM'
     and instrument = $1
     and source_slug = any($2::text[])
     and side = any($3::text[])
     and hour_start >= $4
   order by source_slug, side, hour_start
`;

/**
 * روزانه (بلیت ۳۴): سطرهای خام `quotes`، نه `hourly_rollups` — آن جدول فقط
 * دانه‌بندی ساعتی دارد و نمی‌تواند گام ۱۵دقیقه‌ای بدهد. ستون‌ها با alias به
 * همان نام‌های `RollupRow` نگاشت می‌شوند تا `assemble` بدون تغییر/تکرار روی
 * این نتیجه هم کار کند (کد یکی است، فقط منبع سطر فرق دارد).
 */
const RAW_QUOTES_SQL = `
  select platform_slug as source_slug, side, fetched_at as hour_start, price_toman as close_value
    from quotes
   where instrument = $1
     and platform_slug = any($2::text[])
     and side = any($3::text[])
     and fetched_at >= $4
   order by platform_slug, side, fetched_at
`;

export function createPgHistorySource(): HistorySource {
  const pool = pgPool();

  return {
    async getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]> {
      if (query.platformSlugs.length === 0) return [];
      const since = new Date(Date.now() - query.hours * 3_600_000);
      const stepHours = query.stepHours;

      // بدون stepHours یعنی «روزانه» (بلیت ۳۴): سطرهای خام quotes، گام ۱۵
      // دقیقه — ۹۶ سطل روی پنجره‌ی ۲۴ساعته. نگه‌داری خام ۹۰روزه این پنجره
      // را همیشه پوشش می‌دهد؛ سکوی بی‌سابقه یا پنجره‌ی بیرون از پوشش هم به
      // سری خالی می‌رسد (قاعده‌ی ۵)، نه throw.
      if (stepHours === undefined) {
        const result = await pool.query<RollupRow>(RAW_QUOTES_SQL, [
          query.instrument,
          query.platformSlugs,
          SIDE_PREFERENCE,
          since.toISOString(),
        ]);
        const assembled = assemble(query.platformSlugs, result.rows);
        return assembled.map((entry) => {
          const { points, hasEnoughCoverage } = resampleHourlyPoints(entry.points, {
            since,
            windowHours: query.hours,
            stepHours: DAILY_STEP_HOURS,
          });
          return { ...entry, points, has_enough_coverage: hasEnoughCoverage };
        });
      }

      // هفتگی/ماهانه (بلیت ۳۰): hourly_rollups + resample — دست‌نخورده.
      const result = await pool.query<RollupRow>(SQL, [
        query.instrument,
        query.platformSlugs,
        SIDE_PREFERENCE,
        since.toISOString(),
      ]);
      const assembled = assemble(query.platformSlugs, result.rows);
      if (stepHours <= 1) return assembled;

      return assembled.map((entry) => {
        const { points, hasEnoughCoverage } = resampleHourlyPoints(entry.points, {
          since,
          windowHours: query.hours,
          stepHours,
        });
        return { ...entry, points, has_enough_coverage: hasEnoughCoverage };
      });
    },
  };
}

/**
 * نمونه‌برداری یک سری صعودی به سطل‌های `stepHours` ساعته — هفتگی گام ۲،
 * ماهانه گام ۸ (بلیت ۳۰)، روزانه گام ۰٫۲۵ (۱۵ دقیقه، بلیت ۳۴). واحد ثابت
 * می‌ماند (ساعت)؛ فقط بزرگی گام و جدول منبع (`hourly_rollups` در برابر
 * `quotes`) فرق می‌کند — خودِ این تابع به منبع کاری ندارد، فقط `HistoryPoint`
 * می‌بیند.
 *
 * قاعده‌ی ۱: هیچ میانگینی گرفته نمی‌شود — هر سطل فقط آخرین نمونه‌ی واقعی‌اش
 * را نگه می‌دارد. سطل بی‌نمونه مقدار آخرین سطل شناخته‌شده را ادامه می‌دهد
 * (forward-fill)، ولی فقط *بعد از* اولین نمونه‌ی واقعی؛ سطل‌های پیش از آن —
 * که هنوز هیچ مقداری شناخته نیست — اصلاً در خروجی نمی‌آیند (این یک تصمیم
 * نمایشی است: نه عقب‌گرد جعلی، نه صفر جعلی).
 *
 * `hasEnoughCoverage` یعنی دست‌کم نیمی از سطل‌های کل پنجره نمونه‌ی واقعی
 * داشته‌اند — آستانه‌ی دروازه‌ی «به‌زودی» زبانه‌ی هفتگی/ماهانه‌ی کارت نرخ
 * (زبانه‌ی روزانه همیشه فعال است و این مقدار را نادیده می‌گیرد).
 *
 * تابع خالص — با آرایه‌ی ساده‌ی `HistoryPoint` تست می‌شود، بدون پستگرس.
 */
export function resampleHourlyPoints(
  points: readonly HistoryPoint[],
  options: { since: Date; windowHours: number; stepHours: number },
): { points: HistoryPoint[]; hasEnoughCoverage: boolean } {
  const { since, windowHours, stepHours } = options;
  const totalBuckets = Math.floor(windowHours / stepHours);
  const stepMs = stepHours * 3_600_000;
  const sinceMs = since.getTime();

  // آخرین نمونه‌ی واقعی هر سطل — بدون forward-fill، فقط برای شمار پوشش و
  // برای پرکردن سطل‌های خودشان.
  const realByBucket = new Map<number, HistoryPoint>();
  for (const point of points) {
    const bucketIndex = Math.floor((new Date(point.hour).getTime() - sinceMs) / stepMs);
    if (bucketIndex < 0 || bucketIndex >= totalBuckets) continue;
    realByBucket.set(bucketIndex, point); // نقاط صعودی‌اند؛ آخرین overwrite برنده است
  }

  const output: HistoryPoint[] = [];
  let lastKnown: HistoryPoint | null = null;
  for (let bucket = 0; bucket < totalBuckets; bucket++) {
    const real = realByBucket.get(bucket);
    if (real !== undefined) {
      lastKnown = real;
      output.push(real);
    } else if (lastKnown !== null) {
      output.push({
        hour: new Date(sinceMs + bucket * stepMs).toISOString(),
        value: lastKnown.value,
      });
    }
  }

  return { points: output, hasEnoughCoverage: realByBucket.size >= totalBuckets / 2 };
}

/**
 * گروه‌بندی سطرها به سری هر سکو و انتخاب سطر مرجع.
 *
 * هم برای نتیجه‌ی `hourly_rollups` و هم برای نتیجه‌ی `quotes` خام به کار
 * می‌رود (بلیت ۳۴) — دومی با alias در SQL به شکل `RollupRow` درمی‌آید،
 * پس این تابع هیچ چیزی درباره‌ی دانه‌بندی زمانی نمی‌داند و لازم نیست بداند.
 *
 * تابع خالص و صادرشده تا مرز تست بتواند بدون پستگرس بسنجدش.
 */
export function assemble(platformSlugs: string[], rows: RollupRow[]): PlatformHistory[] {
  const bySlugSide = new Map<string, HistoryPoint[]>();
  for (const row of rows) {
    const key = `${row.source_slug} ${row.side}`;
    let points = bySlugSide.get(key);
    if (points === undefined) {
      points = [];
      bySlugSide.set(key, points);
    }
    points.push({ hour: row.hour_start.toISOString(), value: Number(row.close_value) });
  }

  return platformSlugs.map((slug) => {
    for (const side of SIDE_PREFERENCE) {
      const points = bySlugSide.get(`${slug} ${side}`);
      if (points !== undefined && points.length > 0) {
        const last = points[points.length - 1];
        return {
          platform_slug: slug,
          points,
          latest: last === undefined ? null : last.value,
          side_used: side,
        };
      }
    }
    return { platform_slug: slug, points: [], latest: null, side_used: null };
  });
}

let registered = false;

/** ثبت تنبل — همان الگو و همان دلیلِ `price-source.ts`. */
function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultHistorySource(createPgHistorySource);
}

/** تنها درِ ورود کد سمت سرور به تاریخچه — نه مستقیم از `lib/history.ts`. */
export async function getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]> {
  ensureDefaultSource();
  return readPlatformHistory(query);
}
