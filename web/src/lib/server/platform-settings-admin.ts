/**
 * تنظیمات سکو روی پستگرس — جدول `platform_settings` که مهاجرت
 * `collector/migrations/015_platform_settings.sql` می‌سازد (بلیت ۲۱ + نشانی
 * معرف بلیت ۲۳؛ ستون `referral_url` را مهاجرت #۲۱ از قبل ساخته).
 *
 * **فقط سمت سرور** (همان دلیل `blog-source.ts`/`view-counter.ts`: `pg`
 * هرگز به باندل مرورگر نمی‌رود). از همان استخر مشترک استفاده می‌کند تا
 * سرور تک‌هسته‌ای استخر تازه باز نکند. فهرست سکوهای قابل نمایش از
 * `price-source.ts` می‌آید (زنده‌ی ردیس مقدم، رجیستری بیلد کف — بند ۵
 * طراحی تیکت ۲۱: «اسلاگ باید در فهرست سکوهای واقعاً قابل نمایش باشد»)؛
 * همان منبع `website_url` هر سکو را هم می‌دهد — اعتبارسنجی نشانی معرف
 * (`lib/platform-settings.ts::validateReferralUrls`) دقیقاً همین را
 * می‌خواهد.
 *
 * ⚠️ این فایل هرگز به ردیس نمی‌نویسد — نوشتن پنل فقط پستگرس است؛ گردآورنده
 * خودش با تأخیر ~۲۰ ثانیه `tablo:chart_config` را همگام می‌کند و override
 * نشانی معرف را روی رجیستری زنده می‌نشاند (`tablo_collector.settings`).
 */
import "@tanstack/react-start/server-only";

import {
  loadPlatformSettingsView as domainLoad,
  savePlatformSettings as domainSave,
  setDefaultPlatformSettingsSource,
  type PlatformOption,
  type PlatformSettingEntry,
  type PlatformSettingsSource,
} from "../platform-settings";
import { pgPool } from "./blog-source";
import { getListedPlatforms } from "./price-source";

interface SettingRow {
  slug: string;
  in_chart: boolean;
  chart_color: string | null;
  chart_order: number | null;
  referral_url: string | null;
}

const SELECT_SETTINGS =
  "select slug, in_chart, chart_color, chart_order, referral_url from platform_settings";

const UPSERT_SETTING = `
  insert into platform_settings (slug, in_chart, chart_color, chart_order, referral_url, updated_at)
  values ($1, $2, $3, $4, $5, now())
  on conflict (slug) do update
    set in_chart = excluded.in_chart,
        chart_color = excluded.chart_color,
        chart_order = excluded.chart_order,
        referral_url = excluded.referral_url,
        updated_at = now()
`;

export function createPgPlatformSettingsSource(): PlatformSettingsSource {
  const pool = pgPool();

  return {
    async listPlatforms(): Promise<PlatformOption[]> {
      const listed = await getListedPlatforms();
      return listed.map((platform) => ({
        slug: platform.slug,
        name_fa: platform.name_fa,
        website_url: platform.website_url ?? null,
      }));
    },

    async readSettings(): Promise<PlatformSettingEntry[]> {
      const result = await pool.query<SettingRow>(SELECT_SETTINGS);
      return result.rows.map((row) => ({
        slug: row.slug,
        in_chart: row.in_chart,
        chart_color: row.chart_color,
        chart_order: row.chart_order,
        referral_url: row.referral_url,
      }));
    },

    async writeSettings(entries: PlatformSettingEntry[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const entry of entries) {
          await client.query(UPSERT_SETTING, [
            entry.slug,
            entry.in_chart,
            entry.chart_color,
            entry.chart_order,
            entry.referral_url,
          ]);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let registered = false;

/** ثبت تنبل — همان الگو و همان دلیلِ `view-counter.ts`. */
function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultPlatformSettingsSource(createPgPlatformSettingsSource);
}

/** تنها درِ ورود کد سروری به تنظیمات — نه مستقیم از `lib/platform-settings.ts`. */
export async function loadPlatformSettingsView(): ReturnType<typeof domainLoad> {
  ensureDefaultSource();
  return domainLoad();
}

export async function savePlatformSettings(
  entries: PlatformSettingEntry[],
): ReturnType<typeof domainSave> {
  ensureDefaultSource();
  return domainSave(entries);
}
