import "@tanstack/react-start/server-only";

import Redis from "ioredis";

import {
  listInstruments as readInstruments,
  listPlatforms as readListedPlatforms,
} from "../catalog";
import {
  getPlatformSnapshot as readPlatformSnapshot,
  getUpdatedAt as readUpdatedAt,
  setDefaultPriceSource,
  type InstrumentListing,
  type ListedPlatform,
  type PlatformSnapshot,
  type PriceSource,
} from "../prices";
import {
  fetchRows as readRows,
  fetchRowsForPlatforms as readRowsForPlatforms,
  type Row,
} from "../rows";
import { resolveSlug as readSlug, type SlugResolution } from "../slugs";

/**
 * ⚠️ `commandTimeout` is what keeps "staleness, not error" true in practice.
 * `maxRetriesPerRequest` bounds retries, not wall time: with Redis unreachable
 * every read sits in ioredis' offline queue across reconnect backoffs, and
 * `/tala-18` and `/kodam-saku` measured a 12-second TTFB — still a 200, but any
 * CDN or load balancer with a 5–10s origin read timeout turns that into exactly
 * the 5xx the rule forbids. The timeout is applied before the command is queued,
 * so it bounds the queued time too.
 *
 * ⚠️ One second, not more: a page walks three sequential waves of reads
 * (instruments → listed → snapshots), so the budget multiplies by three before
 * the reader sees anything. A healthy Redis answers in single-digit
 * milliseconds, so this only ever fires on an outage — but it must stay well
 * under a third of whatever read timeout sits in front of the origin.
 */
const REDIS_TIMEOUT_MS = 1000;

export function createRedisPriceSource(): PriceSource {
  const redis = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
    maxRetriesPerRequest: 1,
    commandTimeout: REDIS_TIMEOUT_MS,
    connectTimeout: REDIS_TIMEOUT_MS,
  });

  return {
    async getListedPlatforms(): Promise<ListedPlatform[]> {
      try {
        const raw = await redis.get("tablo:listed");
        if (raw === null) return [];
        return JSON.parse(raw) as ListedPlatform[];
      } catch {
        return [];
      }
    },

    async getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null> {
      try {
        const raw = await redis.get(`tablo:current:${platformSlug}`);
        if (raw === null) return null;
        return JSON.parse(raw) as PlatformSnapshot;
      } catch {
        return null;
      }
    },

    async getUpdatedAt(platformSlug: string): Promise<string | null> {
      try {
        return await redis.get(`tablo:updated_at:${platformSlug}`);
      } catch {
        return null;
      }
    },

    async getInstruments(): Promise<InstrumentListing[]> {
      try {
        const raw = await redis.get("tablo:instruments");
        if (raw === null) return [];
        return JSON.parse(raw) as InstrumentListing[];
      } catch {
        return [];
      }
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultPriceSource(createRedisPriceSource);
}

/**
 * ⚠️ The list of platforms and instruments comes from `lib/catalog.ts`, not
 * from the store itself: a Redis outage must not empty the list, or pages
 * 404 and the sitemap ends up incomplete. The live payload still takes
 * precedence.
 */
export async function getListedPlatforms(): Promise<ListedPlatform[]> {
  ensureDefaultSource();
  return readListedPlatforms();
}

export async function getPlatformSnapshot(platformSlug: string): Promise<PlatformSnapshot | null> {
  ensureDefaultSource();
  return readPlatformSnapshot(platformSlug);
}

export async function getUpdatedAt(platformSlug: string): Promise<string | null> {
  ensureDefaultSource();
  return readUpdatedAt(platformSlug);
}

export async function getInstruments(): Promise<InstrumentListing[]> {
  ensureDefaultSource();
  return readInstruments();
}

export async function fetchRows(): Promise<Row[]> {
  ensureDefaultSource();
  return readRows();
}

export async function fetchRowsForPlatforms(slugs: string[]): Promise<Row[]> {
  ensureDefaultSource();
  return readRowsForPlatforms(slugs);
}

export async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  ensureDefaultSource();
  return readSlug(slug);
}
