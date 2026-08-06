/**
 * منبع واقعی: ردیس — همان کلیدهایی که گردآورنده می‌نویسد
 * (`collector/src/mazane_collector/store/redis_store.py`):
 *
 *     mazane:current:{slug}     ← JSON کامل PlatformSnapshot (با TTL)
 *     mazane:updated_at:{slug}  ← ISO-8601 (بدون TTL — کهنگی، نه خطا)
 *     mazane:listed             ← آرایه‌ی سکوهای قابل نمایش (از قبل فیلترشده)
 *
 * قطع خود ردیس هم «کهنگی است، نه خطا» (قاعده‌ی ۵ قراردادها): هر خطای
 * اتصال/فرمان به «داده‌ای نیست» ترجمه می‌شود تا صفحه همیشه ۲۰۰ بدهد.
 * همین مسیر است که رندر زمان build صفحه‌ی ISR (بلیت ۸) را بدون ردیس سبز
 * نگه می‌دارد — پوسته با «هنوز داده‌ای ثبت نشده است» ساخته می‌شود و اولین
 * revalidate در سرور واقعی داده را می‌آورد.
 */
import Redis from "ioredis";

import type { ListedPlatform, PlatformSnapshot, PriceSource } from "./prices";

export function createRedisSource(): PriceSource {
  const redis = new Redis(process.env.MAZANE_REDIS_URL ?? "redis://127.0.0.1:6379/0", {
    // فرمان معطل نماند: یک تلاش اتصال، بعد رد — لایه‌ی بالا کهنگی نشان می‌دهد.
    maxRetriesPerRequest: 1,
  });

  return {
    async getListedPlatforms(): Promise<ListedPlatform[]> {
      try {
        const raw = await redis.get("mazane:listed");
        if (raw === null) return [];
        return JSON.parse(raw) as ListedPlatform[];
      } catch {
        return [];
      }
    },

    async getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null> {
      try {
        const raw = await redis.get(`mazane:current:${platformSlug}`);
        if (raw === null) return null;
        return JSON.parse(raw) as PlatformSnapshot;
      } catch {
        return null;
      }
    },

    async getUpdatedAt(platformSlug: string): Promise<string | null> {
      try {
        return await redis.get(`mazane:updated_at:${platformSlug}`);
      } catch {
        return null;
      }
    },
  };
}
