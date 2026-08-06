/**
 * شمارنده‌ی بازدید روی پستگرس — جدول `post_views` که مهاجرت
 * `collector/migrations/014_post_views.sql` می‌سازد.
 *
 * **فقط سمت سرور** (همان دلیل `blog-source.ts`: `pg` هرگز به باندل مرورگر
 * نمی‌رود). از همان استخر مشترک استفاده می‌کند تا سرور تک‌هسته‌ای استخر
 * سوم باز نکند.
 *
 * ثبت بازدید یک upsert اتمیک است، پس دو درخواست هم‌زمان همدیگر را
 * بازنویسی نمی‌کنند. کلید خارجی به `posts` یعنی اسلاگ ناشناخته اصلاً ردیف
 * نمی‌سازد؛ ولی مسیر API پیش از رسیدن به اینجا هم اعتبارسنجی می‌کند تا
 * خطای دیتابیس مسیر عادی نشود.
 */
import "@tanstack/react-start/server-only";

import {
  getViewCounts as readViewCounts,
  recordPostView as writePostView,
  setDefaultViewCounter,
  type ViewCounterSource,
  type ViewCounts,
} from "../views";
import { pgPool } from "./blog-source";

interface ViewRow {
  slug: string;
  views: string | number;
}

export function createPgViewCounter(): ViewCounterSource {
  const pool = pgPool();

  return {
    async recordView(slug: string): Promise<void> {
      // upsert اتمیک: ردیف نبود بساز، بود یکی اضافه کن.
      // `posts.updated_at` هرگز لمس نمی‌شود — منبع lastmod سایت‌مپ است.
      await pool.query(
        `insert into post_views (slug, views, last_seen_at)
         values ($1, 1, now())
         on conflict (slug) do update
           set views = post_views.views + 1,
               last_seen_at = now()`,
        [slug],
      );
    },

    async viewCounts(): Promise<ViewCounts> {
      const result = await pool.query<ViewRow>("select slug, views from post_views");
      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        // `bigint` پستگرس در pg رشته می‌آید — تبدیل صریح، نه اتکا به coercion.
        counts[row.slug] = Number(row.views);
      }
      return counts;
    },
  };
}

let registered = false;

/** ثبت تنبل — همان الگو و همان دلیلِ `blog-source.ts`. */
function ensureDefaultCounter(): void {
  if (registered) return;
  registered = true;
  setDefaultViewCounter(createPgViewCounter);
}

/** تنها درِ ورود کد سروری به شمارنده — نه مستقیم از `lib/views.ts`. */
export async function recordPostView(slug: string): Promise<boolean> {
  ensureDefaultCounter();
  return writePostView(slug);
}

export async function getViewCounts(): Promise<ViewCounts> {
  ensureDefaultCounter();
  return readViewCounts();
}
