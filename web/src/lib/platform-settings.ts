/**
 * تنظیمات سکو در پنل مدیریت — عضویت نمودار، رنگ، ترتیب (بلیت ۲۱).
 *
 * آینه‌ی `lib/views.ts`: منبع تزریق‌پذیر است و این ماژول **هرگز** خودش
 * `pg` را import نمی‌کند — `server/platform-settings-admin.ts` کارخانه‌اش
 * را ثبت می‌کند (همان قاعده‌ی باندل: هیچ ماژول نودی در گراف کلاینت).
 *
 * ⚠️ قاعده‌ی سخت ۱ این مخزن: این ماژول **هیچ عدد قیمتی نمی‌سازد یا تغییر
 * نمی‌دهد** — فقط اسلاگ/رنگ/ترتیب می‌خواند و می‌نویسد.
 * ⚠️ قاعده‌ی سخت ۲: عضویت نمودار اینجا هرگز به جدول قیمت راه پیدا نمی‌کند —
 * این فایل اصلاً چیزی درباره‌ی جدول قیمت نمی‌داند.
 * ⚠️ نوشتن فقط پستگرس است — پنل هرگز مستقیم به ردیس نمی‌نویسد؛ گردآورنده
 * خودش با تأخیر ~۲۰ ثانیه همگام می‌کند (`collector/src/mazane_collector/settings.py`).
 */

/** یک سکوی قابل انتخاب — از فهرست سکوهای واقعاً قابل نمایش (`mazane:listed`). */
export interface PlatformOption {
  slug: string;
  name_fa: string;
}

/** یک ردیف تنظیمات — چه ذخیره‌شده باشد چه پیش‌فرض «هنوز تنظیم نشده». */
export interface PlatformSettingEntry {
  slug: string;
  in_chart: boolean;
  chart_color: string | null;
  chart_order: number | null;
}

export interface PlatformSettingsSource {
  /** سکوهای قابل نمایش عمومی — همان چیزی که `mazane:listed` می‌دهد. */
  listPlatforms(): Promise<PlatformOption[]>;
  /** ردیف‌های ذخیره‌شده‌ی `platform_settings` — فقط اسلاگ‌هایی که تا حالا نوشته شده‌اند. */
  readSettings(): Promise<PlatformSettingEntry[]>;
  /** بازنویسی تراکنشی تنظیمات این ردیف‌ها — ورودی از قبل نرمال/اعتبارسنجی‌شده است. */
  writeSettings(entries: PlatformSettingEntry[]): Promise<void>;
}

export type PlatformSettingsFactory = () => PlatformSettingsSource;

let activeSource: PlatformSettingsSource | null = null;
let defaultFactory: PlatformSettingsFactory | null = null;

/** تزریق منبع — در تست‌ها فیک، در صورت نیاز در اجرا هم. */
export function setPlatformSettingsSource(source: PlatformSettingsSource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی پیش‌فرض (پستگرس) — تنبل، تا اولین استفاده ساخته نمی‌شود. */
export function setDefaultPlatformSettingsSource(factory: PlatformSettingsFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetPlatformSettingsSource(): void {
  activeSource = null;
}

function source(): PlatformSettingsSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error("platform settings source not configured");
  }
  activeSource = defaultFactory();
  return activeSource;
}

export const MIN_CHART_PLATFORMS = 2;
export const MAX_CHART_PLATFORMS = 6;

const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidChartColor(color: string): boolean {
  return COLOR_RE.test(color);
}

/**
 * اعتبارسنجی نوشتن (بند ۵ طراحی تیکت ۲۱): بین ۲ تا ۶ سکوی `in_chart=true`،
 * رنگ هر کدام معتبر، و هر اسلاگ در فهرست سکوهای واقعاً قابل نمایش. خروجی
 * رشته یعنی پیام خطا (فارسی، برای نمایش مستقیم در پنل)؛ `null` یعنی معتبر.
 */
export function validatePlatformSettings(
  entries: readonly PlatformSettingEntry[],
  listedSlugs: ReadonlySet<string>,
): string | null {
  for (const entry of entries) {
    if (!listedSlugs.has(entry.slug)) {
      return `سکوی ناشناخته یا غیرقابل‌نمایش: ${entry.slug}`;
    }
  }

  const active = entries.filter((entry) => entry.in_chart);
  if (active.length < MIN_CHART_PLATFORMS) {
    return `دست‌کم ${MIN_CHART_PLATFORMS} سکو باید در نمودار باشد`;
  }
  if (active.length > MAX_CHART_PLATFORMS) {
    return `حداکثر ${MAX_CHART_PLATFORMS} سکو می‌تواند در نمودار باشد`;
  }
  for (const entry of active) {
    if (entry.chart_color === null || !isValidChartColor(entry.chart_color)) {
      return `رنگ نامعتبر برای ${entry.slug}`;
    }
  }
  return null;
}

/**
 * نرمال‌سازی پیش از ذخیره: رنگ همیشه lower، و سکوی خاموش رنگ/ترتیبش پاک
 * می‌شود (بی‌رنگ/بی‌ترتیبِ خاموش یعنی بدون ابهام — یک روز بعد دوباره روشن
 * شد، انتخابی تازه لازم است، نه باقیمانده‌ی کهنه).
 */
export function normalizePlatformSettings(
  entries: readonly PlatformSettingEntry[],
): PlatformSettingEntry[] {
  return entries.map((entry) =>
    entry.in_chart
      ? { ...entry, chart_color: entry.chart_color?.toLowerCase() ?? null }
      : { ...entry, chart_color: null, chart_order: null },
  );
}

/**
 * فهرست سکوهای قابل نمایش + تنظیمات ذخیره‌شده‌شان، برای رندر پنل — سکوی
 * بی‌ردیف در `platform_settings` پیش‌فرض «هنوز تنظیم نشده» می‌گیرد
 * (`in_chart=false`)، نه حذف از فهرست.
 */
export async function loadPlatformSettingsView(): Promise<{
  platforms: PlatformOption[];
  settings: PlatformSettingEntry[];
}> {
  const src = source();
  const [platforms, saved] = await Promise.all([src.listPlatforms(), src.readSettings()]);
  const savedBySlug = new Map(saved.map((entry) => [entry.slug, entry]));
  const settings = platforms.map(
    (platform) =>
      savedBySlug.get(platform.slug) ?? {
        slug: platform.slug,
        in_chart: false,
        chart_color: null,
        chart_order: null,
      },
  );
  return { platforms, settings };
}

/**
 * اعتبارسنجی + نوشتن. خروجی رشته یعنی پیام خطای اعتبارسنجی (هیچ‌چیز نوشته
 * نشد)؛ `null` یعنی موفق.
 */
export async function savePlatformSettings(
  entries: readonly PlatformSettingEntry[],
): Promise<string | null> {
  const src = source();
  const platforms = await src.listPlatforms();
  const listedSlugs = new Set(platforms.map((platform) => platform.slug));

  const error = validatePlatformSettings(entries, listedSlugs);
  if (error !== null) return error;

  await src.writeSettings(normalizePlatformSettings(entries));
  return null;
}
