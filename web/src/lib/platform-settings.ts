/**
 * ⚠️ این مخزن: این ماژول **هیچ عدد قیمتی نمی‌سازد یا تغییر
 * نمی‌دهد** — فقط اسلاگ/رنگ/ترتیب/لینک می‌خواند و می‌نویسد.
 * ⚠️ عضویت نمودار اینجا هرگز به جدول قیمت راه پیدا نمی‌کند —
 * این فایل اصلاً چیزی درباره‌ی جدول قیمت نمی‌داند.
 * ⚠️ نوشتن فقط پستگرس است — پنل هرگز مستقیم به ردیس نمی‌نویسد؛ گردآورنده
 * خودش با تأخیر ~۲۰ ثانیه همگام می‌کند (`collector/src/tablo_collector/settings.py`).
 */
import {
  isValidChartColor,
  MAX_CHART_PLATFORMS,
  MIN_CHART_PLATFORMS,
} from "@/lib/site-content";

export { isValidChartColor, MAX_CHART_PLATFORMS, MIN_CHART_PLATFORMS };

export interface PlatformOption {
  slug: string;
  name_fa: string;
  website_url: string | null;
}

export interface PlatformSettingEntry {
  slug: string;
  in_chart: boolean;
  chart_color: string | null;
  chart_order: number | null;
  referral_url: string | null;
}

export interface PlatformSettingsSource {
  listPlatforms(): Promise<PlatformOption[]>;
  readSettings(): Promise<PlatformSettingEntry[]>;
  writeSettings(entries: PlatformSettingEntry[]): Promise<void>;
}

export type PlatformSettingsFactory = () => PlatformSettingsSource;

let activeSource: PlatformSettingsSource | null = null;
let defaultFactory: PlatformSettingsFactory | null = null;

export function setPlatformSettingsSource(source: PlatformSettingsSource): void {
  activeSource = source;
}

export function setDefaultPlatformSettingsSource(factory: PlatformSettingsFactory): void {
  defaultFactory = factory;
}

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
