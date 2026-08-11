/**
 * منبع واقعی قیمت: ردیس — همان کلیدهایی که گردآورنده می‌نویسد
 * (`collector/src/tablo_collector/store/redis_store.py`):
 *
 *     tablo:current:{slug}     ← JSON کامل PlatformSnapshot (با TTL)
 *     tablo:updated_at:{slug}  ← ISO-8601 (بدون TTL — کهنگی، نه خطا)
 *     tablo:listed             ← آرایه‌ی سکوهای قابل نمایش (از قبل فیلترشده)
 *     tablo:instruments        ← آرایه‌ی دارایی‌ها با وضعیت دروازه‌ی انتشار
 *                                 (بلیت ۷ — بدون TTL، فراداده است نه قیمت)
 *
 * **فقط سمت سرور.** نشانه‌ی `@tanstack/react-start/server-only` بالای فایل
 * باعث می‌شود اگر روزی ماژولی از گراف کلاینت این را import کند، بیلد بشکند
 * نه اینکه بی‌صدا `ioredis` به باندل مرورگر برود. مصرف‌کننده‌ها (لودر مسیر
 * یا createServerFn) باید توابع دامنه را از همین فایل بگیرند، نه از
 * `lib/prices.ts` — چون import همین ماژول است که منبع پیش‌فرض را ثبت می‌کند.
 *
 * قطع خود ردیس هم «کهنگی است، نه خطا» (قاعده‌ی ۵ قراردادها): هر خطای
 * اتصال/فرمان به «داده‌ای نیست» ترجمه می‌شود تا صفحه همیشه ۲۰۰ بدهد.
 */
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
    // فرمان معطل نماند: یک تلاش اتصال، بعد رد — لایه‌ی بالا کهنگی نشان می‌دهد.
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

/**
 * ثبت تنبل: اتصال ردیس تا اولین خواندن باز نمی‌شود، و اگر تستی پیش‌تر
 * `setPriceSource` صدا زده باشد فیک او مقدم می‌ماند (این فقط پیش‌فرض را
 * می‌گذارد).
 *
 * چرا داخل هر تابع و نه یک‌بار در سطح ماژول: ‎package.json‎ روی
 * ‎"sideEffects": false‎ است و اگر این فایل فقط چیزهایی را *بازصدور* می‌کرد،
 * باندلر می‌توانست کل ماژول را دور بزند و ثبت هرگز اجرا نشود. توابع زیر
 * محلی‌اند، پس import شان قطعاً همین ماژول را اجرا می‌کند.
 */
function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultPriceSource(createRedisPriceSource);
}

/**
 * تنها درِ ورود کد سمت سرور به قیمت‌ها — نه مستقیم از `lib/prices.ts`.
 *
 * ⚠️ فهرست سکو و دارایی از `lib/catalog.ts` می‌آید، نه از خودِ استور: قطع
 * ردیس نباید فهرست را تهی کند، وگرنه صفحه‌ها ۴۰۴ و سایت‌مپ ناقص می‌شود
 * (قاعده‌ی ۵ قراردادها). payload زنده همچنان مقدم است.
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

/**
 * ردیف‌های نمایش — همان `lib/rows.ts`، فقط با تضمین ثبت منبع. مصرف‌کننده‌ی
 * سمت سرور باید این را صدا بزند، نه `fetchRows` خام را.
 */
export async function fetchRows(): Promise<Row[]> {
  ensureDefaultSource();
  return readRows();
}

export async function fetchRowsForPlatforms(slugs: string[]): Promise<Row[]> {
  ensureDefaultSource();
  return readRowsForPlatforms(slugs);
}

/** حل اسلاگ تخت به دارایی/سکو — null یعنی ۴۰۴. */
export async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  ensureDefaultSource();
  return readSlug(slug);
}
