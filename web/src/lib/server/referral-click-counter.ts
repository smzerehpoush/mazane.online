import "@tanstack/react-start/server-only";

import Redis from "ioredis";

import {
  getReferralClickReport as readReport,
  recordReferralClick as writeClick,
  setDefaultReferralClickSource,
  type ReferralClickReport,
  type ReferralClicksByDay,
  type ReferralClickSource,
  REFERRAL_CLICK_WINDOW_DAYS,
} from "../referral-clicks";

const KEY_PREFIX = "tablo:go_clicks:";

const RETENTION_SECONDS = 60 * 60 * 24 * 120;

function dayKey(day: string): string {
  return `${KEY_PREFIX}${day}`;
}

function toCounts(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null) return {};
  const counts: Record<string, number> = {};
  for (const [slug, value] of Object.entries(raw as Record<string, string>)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) counts[slug] = parsed;
  }
  return counts;
}

export function createRedisReferralClickSource(): ReferralClickSource {
  const redis = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
    maxRetriesPerRequest: 1,
  });

  return {
    async increment(slug: string, day: string): Promise<void> {
      const key = dayKey(day);
      const results = await redis
        .multi()
        .hincrby(key, slug, 1)
        .expire(key, RETENTION_SECONDS)
        .exec();
      if (results === null) throw new Error("referral click transaction was aborted");
      for (const [error] of results) {
        if (error !== null) throw error;
      }
    },

    async read(days: readonly string[]): Promise<ReferralClicksByDay> {
      const pipeline = redis.pipeline();
      for (const day of days) pipeline.hgetall(dayKey(day));
      const results = await pipeline.exec();
      if (results === null) throw new Error("referral click read was aborted");

      const byDay: Record<string, Record<string, number>> = {};
      days.forEach((day, index) => {
        const entry = results[index];
        if (entry === undefined) return;
        const [error, raw] = entry;
        if (error !== null) throw error;
        byDay[day] = toCounts(raw);
      });
      return byDay;
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultReferralClickSource(createRedisReferralClickSource);
}

export async function recordReferralClick(slug: string): Promise<boolean> {
  ensureDefaultSource();
  return writeClick(slug);
}

export async function getReferralClickReport(
  windowDays: number = REFERRAL_CLICK_WINDOW_DAYS,
): Promise<ReferralClickReport> {
  ensureDefaultSource();
  return readReport(Date.now(), windowDays);
}
