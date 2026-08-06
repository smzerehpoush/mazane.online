/**
 * منبع واقعی: ردیس — همان کلیدهایی که گردآورنده می‌نویسد
 * (`collector/src/mazane_collector/store/redis_store.py`):
 *
 *     mazane:current:{slug}     ← JSON کامل PlatformSnapshot (با TTL)
 *     mazane:updated_at:{slug}  ← ISO-8601 (بدون TTL — کهنگی، نه خطا)
 *     mazane:listed             ← آرایه‌ی سکوهای قابل نمایش (از قبل فیلترشده)
 */
import Redis from "ioredis";

import type { ListedPlatform, PlatformSnapshot, PriceSource } from "./prices";

export function createRedisSource(): PriceSource {
  const redis = new Redis(process.env.MAZANE_REDIS_URL ?? "redis://127.0.0.1:6379/0", {
    maxRetriesPerRequest: 1,
  });

  return {
    async getListedPlatforms(): Promise<ListedPlatform[]> {
      const raw = await redis.get("mazane:listed");
      if (raw === null) return [];
      return JSON.parse(raw) as ListedPlatform[];
    },

    async getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null> {
      const raw = await redis.get(`mazane:current:${platformSlug}`);
      if (raw === null) return null;
      return JSON.parse(raw) as PlatformSnapshot;
    },

    async getUpdatedAt(platformSlug: string): Promise<string | null> {
      return redis.get(`mazane:updated_at:${platformSlug}`);
    },
  };
}
