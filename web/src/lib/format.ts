/**
 * ⚠️ Digits come from `lib/fa-number.ts`, **not** from `Intl.NumberFormat`.
 * The full reason is in that same file: `Intl`'s output is tied to the ICU
 * version, and the server's version doesn't match the browser's, so that
 * was the real source of the hydration mismatch. The output is
 * byte-for-byte the same as it was before.
 * ⚠️ Dates still use `Intl.DateTimeFormat`: the Jalali calendar can't be
 * hand-written without a full and risky manual implementation, and the
 * risk is lower than with numbers anyway (a post's publish date is fixed
 * and doesn't change every 30 seconds).
 */
import {
  formatFaNumber,
  formatFaPercentFromFraction,
  formatFaPercentPoints,
  formatFaYear,
} from "./fa-number";

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeZone: "Asia/Tehran",
});

export const STALE_AFTER_MINUTES = 3;

export function formatToman(priceToman: number): string {
  return formatFaNumber(priceToman);
}

export function formatYearFa(year: number): string {
  return formatFaYear(year);
}

export function formatPercentFa(fraction: number): string {
  return formatFaPercentFromFraction(fraction, { maximumFractionDigits: 2 });
}

export function formatSignedPercentFa(fraction: number): string {
  return formatFaPercentFromFraction(fraction, {
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });
}

export function formatPercentPointsFa(points: string | number): string {
  return formatFaPercentPoints(Number(points), { maximumFractionDigits: 3 });
}

export function formatDateTimeFa(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatDateFa(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

export function isStale(minutes: number): boolean {
  return minutes >= STALE_AFTER_MINUTES;
}

export function formatMinutesAgoFa(minutes: number): string {
  if (minutes < 1) return "لحظاتی پیش";
  if (minutes < 60) return `${formatFaNumber(minutes)} دقیقه پیش`;
  if (minutes < 1440) return `${formatFaNumber(Math.floor(minutes / 60))} ساعت پیش`;
  return `${formatFaNumber(Math.floor(minutes / 1440))} روز پیش`;
}
