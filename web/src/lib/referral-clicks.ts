/**
 * ⚠️ **Why counting happens in the `/go/` handler, not in a page loader:**
 * page HTML is cached at Arvan's edge, so a loader-side count measures
 * cache misses rather than people — the same reason `lib/views.ts` counts
 * from the browser. `/go/` responses are `no-store`, so every click really
 * does reach this handler and the number is honest.
 *
 * ⚠️ **The counter keys on the slug and nothing else.** `referral_url`
 * carries the referral code (see the warning at the top of
 * `server/go-redirect.ts`); it must never reach the store, a log, or this
 * module's arguments.
 */

import { tehranDay, tehranDayWindow } from "./tehran-day";

export const REFERRAL_CLICK_WINDOW_DAYS = 14;

export type ReferralClicksByDay = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface ReferralClickSource {
  increment(slug: string, day: string): Promise<void>;
  read(days: readonly string[]): Promise<ReferralClicksByDay>;
}

export type ReferralClickSourceFactory = () => ReferralClickSource;

export interface ReferralClickRow {
  slug: string;
  daily: number[];
  today: number;
  total: number;
}

export interface ReferralClickReport {
  days: string[];
  rows: ReferralClickRow[];
  total: number;
  available: boolean;
}

let activeSource: ReferralClickSource | null = null;
let defaultFactory: ReferralClickSourceFactory | null = null;

export function setReferralClickSource(source: ReferralClickSource): void {
  activeSource = source;
}

export function setDefaultReferralClickSource(factory: ReferralClickSourceFactory): void {
  defaultFactory = factory;
}

export function resetReferralClickSource(): void {
  activeSource = null;
}

function source(): ReferralClickSource | null {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) return null;
  activeSource = defaultFactory();
  return activeSource;
}

export function referralClickDay(nowMs: number): string {
  return tehranDay(nowMs);
}

export function referralClickDays(
  nowMs: number,
  windowDays: number = REFERRAL_CLICK_WINDOW_DAYS,
): string[] {
  return tehranDayWindow(nowMs, windowDays);
}

export async function recordReferralClick(
  slug: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const counter = source();
  if (counter === null) return false;
  try {
    await counter.increment(slug, referralClickDay(nowMs));
    return true;
  } catch (error) {
    console.error("referral click counter unavailable; click not recorded", error);
    return false;
  }
}

export function buildReferralClickReport(
  days: string[],
  byDay: ReferralClicksByDay,
  available: boolean,
): ReferralClickReport {
  const slugs = new Set<string>();
  for (const day of days) {
    for (const slug of Object.keys(byDay[day] ?? {})) slugs.add(slug);
  }

  const rows: ReferralClickRow[] = [...slugs].map((slug) => {
    const daily = days.map((day) => byDay[day]?.[slug] ?? 0);
    return {
      slug,
      daily,
      today: daily[daily.length - 1] ?? 0,
      total: daily.reduce((sum, value) => sum + value, 0),
    };
  });

  rows.sort((a, b) => {
    const diff = b.total - a.total;
    return diff !== 0 ? diff : a.slug.localeCompare(b.slug);
  });

  return {
    days,
    rows,
    total: rows.reduce((sum, row) => sum + row.total, 0),
    available,
  };
}

export async function getReferralClickReport(
  nowMs: number = Date.now(),
  windowDays: number = REFERRAL_CLICK_WINDOW_DAYS,
): Promise<ReferralClickReport> {
  const days = referralClickDays(nowMs, windowDays);
  const counter = source();
  if (counter === null) return buildReferralClickReport(days, {}, false);
  try {
    return buildReferralClickReport(days, await counter.read(days), true);
  } catch (error) {
    console.error("referral click counter unavailable; reporting no data", error);
    return buildReferralClickReport(days, {}, false);
  }
}
