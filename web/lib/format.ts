/**
 * نمایش فارسی — فقط قالب‌بندی، بدون هیچ محاسبه‌ی قیمتی.
 * ارقام نمایش با `Intl.NumberFormat('fa-IR')` (قراردادها، بخش استک).
 */

const tomanFormatter = new Intl.NumberFormat("fa-IR");

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeZone: "Asia/Tehran",
});

/** آستانه‌ی کهنگی هر ردیف: polling ۳۰ ثانیه است، پس ۳ دقیقه یعنی چند نوبتِ ازدست‌رفته. */
export const STALE_AFTER_MINUTES = 3;

export function formatToman(priceToman: number): string {
  return tomanFormatter.format(priceToman);
}

export function formatDateTimeFa(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatDateFa(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** دقیقه‌های سپری‌شده از یک زمان ISO — فقط تفاضل زمان، هیچ محاسبه‌ی قیمتی نیست. */
export function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

export function isStale(minutes: number): boolean {
  return minutes >= STALE_AFTER_MINUTES;
}

export function formatMinutesAgoFa(minutes: number): string {
  if (minutes < 1) return "لحظاتی پیش";
  return `${tomanFormatter.format(minutes)} دقیقه پیش`;
}
