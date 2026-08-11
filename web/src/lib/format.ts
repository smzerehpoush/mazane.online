/**
 * نمایش فارسی — فقط قالب‌بندی، بدون هیچ محاسبه‌ی قیمتی.
 *
 * ⚠️ ارقام از `lib/fa-number.ts` می‌آیند، **نه** از `Intl.NumberFormat`.
 * دلیلش کامل در همان فایل است: خروجی `Intl` به نسخه‌ی ICU گره خورده و
 * نسخه‌ی سرور با نسخه‌ی مرورگر یکی نیست، پس تنها منبع واقعی
 * hydration mismatch همان بود (بند ۱۴ سند طراحی). خروجی بایت‌به‌بایت همان
 * چیزی است که قبلاً بود.
 *
 * ⚠️ تاریخ‌ها هنوز روی `Intl.DateTimeFormat` اند: تقویم جلالی را نمی‌شود
 * بدون یک پیاده‌سازی کامل و پرخطر دستی نوشت، و ریسکش هم از عدد کمتر است
 * (تاریخ انتشار پست ثابت است و هر ۳۰ ثانیه عوض نمی‌شود).
 */
import { formatFaNumber, formatFaPercentFromFraction, formatFaPercentPoints } from "./fa-number";

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
  return formatFaNumber(priceToman);
}

/** کسر (مثلاً ۰٫۰۰۳۹) ⟸ «۰٫۳۹٪». خودِ کسر ورودی است — اینجا فقط قالب است. */
export function formatPercentFa(fraction: number): string {
  return formatFaPercentFromFraction(fraction, { maximumFractionDigits: 2 });
}

/**
 * کسرِ تغییر (مثلاً ۰٫۰۰۳۹ یا −۰٫۰۰۱۲) ⟸ «۰٫۳۹٪+» یا «۰٫۱۲٪−». همان کسر
 * تفاضل سر و ته یک سری آماده است — فقط قالب‌بندی، هیچ فرمول قیمتی نیست.
 * علامت +/− صریح: کارت نرخ سکو، ستون «تغییرات» (بلیت ۲۷).
 */
export function formatSignedPercentFa(fraction: number): string {
  return formatFaPercentFromFraction(fraction, {
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });
}

/**
 * درصدِ آماده‌ی گردآورنده — رشته‌ای بر حسب واحد درصد (مثلاً "0.9950") ⟸
 * «۰٫۹۹۵٪». فقط قالب‌بندی همان عدد؛ هیچ محاسبه‌ای در کار نیست.
 */
export function formatPercentPointsFa(points: string | number): string {
  return formatFaPercentPoints(Number(points), { maximumFractionDigits: 3 });
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
  return `${formatFaNumber(minutes)} دقیقه پیش`;
}
