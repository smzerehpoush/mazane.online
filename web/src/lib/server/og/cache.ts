import "@tanstack/react-start/server-only";

import Redis from "ioredis";

export const OG_CACHE_TTL_SECONDS = 900;

export interface OgImageCache {
  read(key: string): Promise<Buffer | null>;
  write(key: string, image: Buffer, ttlSeconds: number): Promise<void>;
}

let active: OgImageCache | null = null;
let client: Redis | null = null;

export function setOgImageCache(cache: OgImageCache | null): void {
  active = cache;
}

function redisClient(): Redis {
  if (client === null) {
    client = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
      maxRetriesPerRequest: 1,
    });
  }
  return client;
}

function redisCache(): OgImageCache {
  return {
    read: (key) => redisClient().getBuffer(`tablo:og:${key}`),
    write: async (key, image, ttlSeconds) => {
      await redisClient().set(`tablo:og:${key}`, image, "EX", ttlSeconds);
    },
  };
}

function cache(): OgImageCache {
  return active ?? redisCache();
}

export async function readCachedOgImage(key: string): Promise<Buffer | null> {
  try {
    return await cache().read(key);
  } catch (error) {
    console.error("og image cache read failed; rendering fresh", error);
    return null;
  }
}

export async function writeCachedOgImage(key: string, image: Buffer): Promise<void> {
  try {
    await cache().write(key, image, OG_CACHE_TTL_SECONDS);
  } catch (error) {
    console.error("og image cache write failed; serving uncached", error);
  }
}
