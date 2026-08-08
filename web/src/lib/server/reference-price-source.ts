/**
 * منبع واقعی نوار «نرخ اتحادیه» (تیکت ۳۳): پستگرس، جدول `hourly_rollups`
 * (`collector/migrations/011_retention.sql`)، `kind = 'REFERENCE'`.
 *
 * **فقط سمت سرور.** استخر اتصال با `blog-source.ts` مشترک است (همان دلیل
 * `history-source.ts`: یک سرور تک‌هسته‌ای، یک استخر).
 *
 * چه می‌خوانَد: آخرین ردیف `kind='REFERENCE'` برای اسلاگ منبع + دارایی
 * خواسته‌شده. مرجع همیشه با `Side.MID` نوشته می‌شود
 * (`collector/src/mazane_collector/references/talair.py`) — برخلاف
 * `history-source.ts` که بین `MEAN`/`MID` سکو ترجیح می‌دهد، اینجا فقط یک
 * سمت وجود دارد، پس مستقیم فیلتر می‌شود.
 *
 * هیچ محاسبه‌ای اینجا نیست (قاعده‌ی ۱): `close_value` همان عددی است که
 * گردآورنده نوشته و فقط از `numeric` (رشته در درایور pg) به عدد تبدیل می‌شود.
 *
 * قطع منبع/ردیف نبودن ⟸ `null` (کهنگی، نه خطا؛ قاعده‌ی ۵) — لایه‌ی دامنه
 * (`lib/reference-price.ts`) خودش خطای پستگرس را قورت می‌دهد، اینجا فقط
 * «ردیفی نیست» ⟸ `null` را برمی‌گرداند.
 */
import "@tanstack/react-start/server-only";

import {
  getReferencePrice as readReferencePrice,
  setDefaultReferencePriceSource,
  type ReferencePrice,
  type ReferencePriceQuery,
  type ReferencePriceSource,
} from "../reference-price";
import { pgPool } from "./blog-source";

interface RollupRow {
  hour_start: Date;
  close_value: string;
}

const SQL = `
  select hour_start, close_value
    from hourly_rollups
   where kind = 'REFERENCE'
     and source_slug = $1
     and instrument = $2
     and side = 'MID'
   order by hour_start desc
   limit 1
`;

export function createPgReferencePriceSource(): ReferencePriceSource {
  const pool = pgPool();

  return {
    async getReferencePrice(query: ReferencePriceQuery): Promise<ReferencePrice | null> {
      const result = await pool.query<RollupRow>(SQL, [query.referenceSlug, query.instrument]);
      const row = result.rows[0];
      if (row === undefined) return null;
      return {
        reference_slug: query.referenceSlug,
        instrument: query.instrument,
        value: Number(row.close_value),
        read_at: row.hour_start.toISOString(),
      };
    },
  };
}

let registered = false;

/** ثبت تنبل — همان الگو و همان دلیلِ `price-source.ts` / `history-source.ts`. */
function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultReferencePriceSource(createPgReferencePriceSource);
}

/** تنها درِ ورود کد سمت سرور به مرجع قیمت — نه مستقیم از `lib/reference-price.ts`. */
export async function getReferencePrice(
  query: ReferencePriceQuery,
): Promise<ReferencePrice | null> {
  ensureDefaultSource();
  return readReferencePrice(query);
}
