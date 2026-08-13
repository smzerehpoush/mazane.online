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

export function createRedisPriceSource(): PriceSource {
  const redis = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
    maxRetriesPerRequest: 1,
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
 * ⚠️ فهرست سکو و دارایی از `lib/catalog.ts` می‌آید، نه از خودِ استور: قطع
 * ردیس نباید فهرست را تهی کند، وگرنه صفحه‌ها ۴۰۴ و سایت‌مپ ناقص می‌شود
 * . payload زنده همچنان مقدم است.
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
