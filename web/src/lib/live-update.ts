import { formatMinutesAgoFa, isStale, minutesSince } from "./format";

export interface LivePriceRow {
  platform_slug: string;
  price_toman: number | null;
  price_display: string | null;
  updated_at: string | null;
}

/**
 * ⚠️ به‌ویژه `rail_percent`: موقعیت روی محور به کمینه/بیشینه‌ی کل مجموعه
 * وابسته است، پس با هر نوبت عوض می‌شود. اگر کلاینت خودش حسابش می‌کرد، هم
 * می‌شکست و هم دو پیاده‌سازی از یک هندسه داشتیم که می‌توانند
 * واگرا شوند. کلاینت فقط عدد را در `style.right` می‌نشاند.
 */
export interface LiveDashboardSource {
  slug: string;
  price_toman: number | null;
  price_display: string | null;
  rail_percent: number | null;
  stem_long: boolean;
  updated_at: string | null;
}

export interface LiveDashboard {
  sources: LiveDashboardSource[];
  max_display: string | null;
  min_display: string | null;
  spread_display: string | null;
  reference_percent: number | null;
  updated_at: string | null;
  /**
   * ⚠️ رشته‌ی آماده می‌آید و کلاینت قالب‌بندی نمی‌کند — همان قاعده‌ای که کل
   * این payload بر آن بنا شده. بدون این فیلد، برچسب «آخرین به‌روزرسانی» روی
   * زمان رندر سرور یخ می‌زد در حالی که قیمت‌های کنارش هر ۳۰ ثانیه عوض
   * می‌شدند — یعنی دقیقاً همان برچسبی که کارش گفتن سن داده است، دروغ می‌گفت.
   */
  updated_at_display: string | null;
}

export interface LivePricesPayload {
  generated_at: string;
  rows: LivePriceRow[];
  dashboard?: LiveDashboard;
}

export interface LiveRowDomState {
  priceText: string;
  updatedAtIso: string | null;
  updatedText: string;
  staleText: string;
}

export const STALE_SUFFIX_FA = " (کهنه)";

export function nextRowDomState(
  current: LiveRowDomState,
  update: LivePriceRow | undefined,
  nowMs: number,
): LiveRowDomState {
  const priceText =
    update !== undefined && update.price_display !== null
      ? update.price_display
      : current.priceText;
  const updatedAtIso = update?.updated_at ?? current.updatedAtIso;
  if (updatedAtIso === null) {
    return { ...current, priceText };
  }
  const minutes = minutesSince(updatedAtIso, nowMs);
  return {
    priceText,
    updatedAtIso,
    updatedText: formatMinutesAgoFa(minutes),
    staleText: isStale(minutes) ? STALE_SUFFIX_FA : "",
  };
}

export const RATE_CARD_POLL_SECONDS = 30;

export interface RateCardCountdownTick {
  secondsRemaining: number;
  shouldFetch: boolean;
}

export function nextRateCardCountdown(
  secondsRemaining: number,
  isStaleNow: boolean,
): RateCardCountdownTick {
  if (isStaleNow) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: false };
  }
  if (secondsRemaining <= 0) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: true };
  }
  return { secondsRemaining: secondsRemaining - 1, shouldFetch: false };
}
