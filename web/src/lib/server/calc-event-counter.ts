import "@tanstack/react-start/server-only";

import Redis from "ioredis";

import {
  getCalcEventReport as readReport,
  recordCalcEvent as writeEvent,
  setDefaultCalcEventSource,
  type CalcEvent,
  type CalcEventReport,
  type CalcEventsByDay,
  type CalcEventSource,
  type CalcTool,
  CALC_EVENT_WINDOW_DAYS,
} from "../calc-events";

const KEY_PREFIX = "tablo:calc_events:";

const RETENTION_SECONDS = 60 * 60 * 24 * 120;

function dayKey(day: string): string {
  return `${KEY_PREFIX}${day}`;
}

function toCounts(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null) return {};
  const counts: Record<string, number> = {};
  for (const [field, value] of Object.entries(raw as Record<string, string>)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) counts[field] = parsed;
  }
  return counts;
}

export function createRedisCalcEventSource(): CalcEventSource {
  const redis = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
    maxRetriesPerRequest: 1,
  });

  return {
    async increment(field: string, day: string): Promise<void> {
      const key = dayKey(day);
      const results = await redis
        .multi()
        .hincrby(key, field, 1)
        .expire(key, RETENTION_SECONDS)
        .exec();
      if (results === null) throw new Error("calc event transaction was aborted");
      for (const [error] of results) {
        if (error !== null) throw error;
      }
    },

    async read(days: readonly string[]): Promise<CalcEventsByDay> {
      const pipeline = redis.pipeline();
      for (const day of days) pipeline.hgetall(dayKey(day));
      const results = await pipeline.exec();
      if (results === null) throw new Error("calc event read was aborted");

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
  setDefaultCalcEventSource(createRedisCalcEventSource);
}

export async function recordCalcEvent(tool: CalcTool, event: CalcEvent): Promise<boolean> {
  ensureDefaultSource();
  return writeEvent(tool, event);
}

export async function getCalcEventReport(
  windowDays: number = CALC_EVENT_WINDOW_DAYS,
): Promise<CalcEventReport> {
  ensureDefaultSource();
  return readReport(Date.now(), windowDays);
}
