/**
 * تنظیمات سکو در پنل مدیریت — عضویت نمودار، رنگ، ترتیب (بلیت ۲۱) + نشانی
 * معرف (بلیت ۲۳).
 *
 * آینه‌ی `lib/views.ts`: منبع تزریق‌پذیر است و این ماژول **هرگز** خودش
 * `pg` را import نمی‌کند — `server/platform-settings-admin.ts` کارخانه‌اش
 * را ثبت می‌کند (همان قاعده‌ی باندل: هیچ ماژول نودی در گراف کلاینت).
 *
 * ⚠️ قاعده‌ی سخت ۱ این مخزن: این ماژول **هیچ عدد قیمتی نمی‌سازد یا تغییر
 * نمی‌دهد** — فقط اسلاگ/رنگ/ترتیب/لینک می‌خواند و می‌نویسد.
 * ⚠️ قاعده‌ی سخت ۲: عضویت نمودار اینجا هرگز به جدول قیمت راه پیدا نمی‌کند —
 * این فایل اصلاً چیزی درباره‌ی جدول قیمت نمی‌داند.
 * ⚠️ نوشتن فقط پستگرس است — پنل هرگز مستقیم به ردیس نمی‌نویسد؛ گردآورنده
 * خودش با تأخیر ~۲۰ ثانیه همگام می‌کند (`collector/src/mazane_collector/settings.py`).
 *
 * لینک معرف (بلیت ۲۳): مالک نشانی معرف هر سکو را اینجا وارد/پاک می‌کند.
 * قلب اعتبارسنجی همین‌جاست (`validateReferralUrls`) — پیش از insert/update
 * پستگرس: فقط https، و hostname باید دقیقاً برابر hostname وبسایت رسمی
 * سکو (`website_url` — از `mazane:listed`، همان منبعی که `listPlatforms`
 * برای فهرست سکوها می‌خواند) باشد یا زیردامنه‌ی آن. خالی‌کردن فیلد مجاز
 * است (یعنی حذف override — رفتار برمی‌گردد به `website_url`، نه ۴۰۴).
 */

/** یک سکوی قابل انتخاب — از فهرست سکوهای واقعاً قابل نمایش (`mazane:listed`). */
export interface PlatformOption {
  slug: string;
  name_fa: string;
  /** برای اعتبارسنجی هم‌دامنه‌ی نشانی معرف (بلیت ۲۳) — نبودش یعنی هیچ
   * نشانی معرفی برای این سکو معتبر نیست (چیزی برای مقایسه نداریم). */
  website_url: string | null;
}

/** یک ردیف تنظیمات — چه ذخیره‌شده باشد چه پیش‌فرض «هنوز تنظیم نشده». */
export interface PlatformSettingEntry {
  slug: string;
  in_chart: boolean;
  chart_color: string | null;
  chart_order: number | null;
  /** override نشانی معرف (بلیت ۲۳)؛ `null` یعنی override ندارد ⟸
   * ‎/go/<slug>‎ به `website_url` می‌رود — مستقل از عضویت نمودار. */
  referral_url: string | null;
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
 * اعتبارسنجی طرح/دامنه‌ی نشانی معرف (بلیت ۲۳ — «قلب این تیکت»): فقط https،
 * و hostname باید دقیقاً برابر hostname وبسایت رسمی سکو باشد یا زیردامنه‌ی
 * آن. `websiteUrl === null` (سکو بدون نشانی رسمی مستند) ⟸ همیشه نامعتبر —
 * چیزی برای مقایسه نداریم، پس هیچ نشانی‌ای پذیرفته نیست.
 *
 * زیردامنه با `endsWith(".${officialHost}")` سنجیده می‌شود — با نقطه‌ی
 * پیشوند، تا «evilwallgold.ir» به اشتباه زیردامنه‌ی «wallgold.ir» حساب
 * نشود (این دقیقاً همان حمله‌ای است که بند ۵ طراحی تیکت هشدار می‌دهد).
 */
export function isValidReferralUrl(url: string, websiteUrl: string | null): boolean {
  if (websiteUrl === null) return false;
  let target: URL;
  let official: URL;
  try {
    target = new URL(url);
    official = new URL(websiteUrl);
  } catch {
    return false;
  }
  if (target.protocol !== "https:") return false;
  const host = target.hostname.toLowerCase();
  const officialHost = official.hostname.toLowerCase();
  return host === officialHost || host.endsWith(`.${officialHost}`);
}

/**
 * اعتبارسنجی همه‌ی ردیف‌ها — مستقل از عضویت نمودار (لینک معرف حتی برای
 * سکوی خاموش هم معنا دارد: کلیک از صفحه‌ی خودِ سکو). `entry.referral_url
 * === null` یعنی override ندارد ⟸ همیشه معتبر (فرود امن به website_url).
 * پیام خطا فقط اسلاگ را می‌گوید، هرگز خودِ نشانی را.
 */
export function validateReferralUrls(
  entries: readonly PlatformSettingEntry[],
  platforms: readonly PlatformOption[],
): string | null {
  const websiteBySlug = new Map(platforms.map((platform) => [platform.slug, platform.website_url]));
  for (const entry of entries) {
    if (entry.referral_url === null) continue;
    const websiteUrl = websiteBySlug.get(entry.slug) ?? null;
    if (!isValidReferralUrl(entry.referral_url, websiteUrl)) {
      return `نشانی معرف نامعتبر برای ${entry.slug}: باید https و هم‌دامنه یا زیردامنه‌ی وبسایت رسمی سکو باشد`;
    }
  }
  return null;
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

function normalizeReferralUrl(url: string | null): string | null {
  if (url === null) return null;
  const trimmed = url.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * نرمال‌سازی پیش از ذخیره: رنگ همیشه lower، و سکوی خاموش رنگ/ترتیبش پاک
 * می‌شود (بی‌رنگ/بی‌ترتیبِ خاموش یعنی بدون ابهام — یک روز بعد دوباره روشن
 * شد، انتخابی تازه لازم است، نه باقیمانده‌ی کهنه). نشانی معرف مستقل از
 * عضویت نمودار trim می‌شود؛ خالی (بعد از trim) یعنی حذف override (بلیت ۲۳).
 */
export function normalizePlatformSettings(
  entries: readonly PlatformSettingEntry[],
): PlatformSettingEntry[] {
  return entries.map((entry) => {
    const referral_url = normalizeReferralUrl(entry.referral_url);
    return entry.in_chart
      ? { ...entry, chart_color: entry.chart_color?.toLowerCase() ?? null, referral_url }
      : { ...entry, chart_color: null, chart_order: null, referral_url };
  });
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
        referral_url: null,
      },
  );
  return { platforms, settings };
}

/**
 * تغییر نشانی معرف را با اسلاگ و زمان لاگ می‌کند — **هرگز خودِ نشانی را
 * چاپ نمی‌کند** (بلیت ۲۳: نشانی معرف حامل کد مالک است). مقایسه با آخرین
 * تنظیمات ذخیره‌شده (`previous`)؛ سکوی بی‌ردیف قبلی یعنی `referral_url`
 * قبلی‌اش `null` بوده.
 */
function logReferralChanges(
  previous: readonly PlatformSettingEntry[],
  next: readonly PlatformSettingEntry[],
): void {
  const previousBySlug = new Map(previous.map((entry) => [entry.slug, entry.referral_url]));
  const changedAt = new Date().toISOString();
  for (const entry of next) {
    const before = previousBySlug.get(entry.slug) ?? null;
    if (before !== entry.referral_url) {
      console.info(`[platform-settings] لینک معرف ${entry.slug} تغییر کرد — ${changedAt}`);
    }
  }
}

/**
 * اعتبارسنجی + نوشتن. خروجی رشته یعنی پیام خطای اعتبارسنجی (هیچ‌چیز نوشته
 * نشد)؛ `null` یعنی موفق. عضویت نمودار (بند ۵ طراحی تیکت ۲۱) و نشانی معرف
 * (بند طراحی تیکت ۲۳) دو دروازه‌ی جدا هستند — هر دو باید عبور کنند.
 */
export async function savePlatformSettings(
  entries: readonly PlatformSettingEntry[],
): Promise<string | null> {
  const src = source();
  const platforms = await src.listPlatforms();
  const listedSlugs = new Set(platforms.map((platform) => platform.slug));

  const error = validatePlatformSettings(entries, listedSlugs);
  if (error !== null) return error;

  const normalized = normalizePlatformSettings(entries);

  const referralError = validateReferralUrls(normalized, platforms);
  if (referralError !== null) return referralError;

  const previous = await src.readSettings();
  logReferralChanges(previous, normalized);

  await src.writeSettings(normalized);
  return null;
}
