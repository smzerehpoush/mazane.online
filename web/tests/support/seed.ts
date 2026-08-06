/**
 * seed مشترک مرز وب: منبع داده با ‎setPriceSource‎ / ‎setBlogSource‎ /
 * ‎setHistorySource‎ تزریق می‌شود؛ هیچ ردیس/پستگرس/شبکه‌ای در کار نیست و
 * `ioredis`/`pg` اصلاً به گراف تست نمی‌آیند (تست‌ها فقط اجزای خالص زیر
 * `src/components/` و توابع `src/lib/` را import می‌کنند، نه مسیرها).
 *
 * اعداد همان شکل JSON کانونی گردآورنده‌اند — قیمت‌های مؤثر و «قیمت مرجع سکو»
 * از قبل آنجا محاسبه شده‌اند (قاعده‌ی ۱ قراردادها).
 *
 * این فایل تست نیست (الگوی ‎*.test.*‎ را ندارد) — فقط کمک‌کار مرز وب است.
 */
import type { SlugPageData } from "../../src/components/content/SlugPageView";
import type { HomePageData } from "../../src/components/mazane/HomePage";
import { listPublishedPosts, setBlogSource, type BlogPost } from "../../src/lib/blog";
import { setImageStore, type ImageStore, type UploadedImage } from "../../src/lib/images";
import { setViewCounter, type ViewCounts } from "../../src/lib/views";
import { getPlatformHistory, setHistorySource, type PlatformHistory } from "../../src/lib/history";
import { assembleHomeData, assembleSlugPage } from "../../src/lib/page-data";
import { listInstruments } from "../../src/lib/catalog";
import type { ChartPlatformConfig } from "../../src/lib/site-content";
import {
  getPlatformSnapshot,
  getUpdatedAt,
  setPriceSource,
  type FeeSource,
  type InstrumentListing,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
  type Side,
} from "../../src/lib/prices";
import { fetchRows, fetchRowsForPlatforms } from "../../src/lib/rows";
import { resolveSlug } from "../../src/lib/slugs";

export function quote(
  slug: string,
  side: Side,
  priceToman: number,
  fetchedAt: string,
  instrument: string = "GOLD_18K",
): Quote {
  return {
    platform_slug: slug,
    instrument,
    side,
    price_toman: priceToman,
    raw_value: String(priceToman),
    raw_scale: "1",
    fetched_at: fetchedAt,
  };
}

export function makeSnapshot(opts: {
  slug: string;
  mid: number;
  /** برای fee_source=UNKNOWN نده — گردآورنده برای آن سکوها فقط MID می‌نویسد. */
  buy?: number;
  sell?: number;
  feeSource?: FeeSource;
  feeObservedAt?: string;
  fetchedAt?: string;
  buyFee?: string;
  sellFee?: string;
  roundTrip?: string;
  /** پیش‌فرض GOLD_18K — صفحه‌ی دارایی (بلیت ۷) کد خودش را می‌دهد. */
  instrument?: string;
  /**
   * قیمت مرجع سکو — عدد آماده‌ی گردآورنده (تصمیم مالک ۲۰۲۶-۰۸-۰۶: تک‌قیمتی
   * همان تک‌عددش، دوقیمتی میانگین دو عدد خودش). نده ⟸ کلیدی در payload نیست
   * (کارمزد نامعلوم / دفتر یک‌طرفه).
   */
  reference?: number;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  minOrderToman?: string;
}): PlatformSnapshot {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
  const feeSource = opts.feeSource ?? "API";
  const unknown = feeSource === "UNKNOWN";
  const instrument = opts.instrument ?? "GOLD_18K";
  const quotes: Quote[] = [quote(opts.slug, "MID", opts.mid, fetchedAt, instrument)];
  if (!unknown && opts.buy !== undefined) {
    quotes.push(quote(opts.slug, "BUY", opts.buy, fetchedAt, instrument));
  }
  if (!unknown && opts.sell !== undefined) {
    quotes.push(quote(opts.slug, "SELL", opts.sell, fetchedAt, instrument));
  }
  return {
    platform_slug: opts.slug,
    quotes,
    terms: {
      platform_slug: opts.slug,
      // کارمزد UNKNOWN یعنی هر سه تهی — عدد نصفه‌نیمه در گردآورنده باگ است.
      buy_fee_percent: unknown ? null : (opts.buyFee ?? "0.5"),
      sell_fee_percent: unknown ? null : (opts.sellFee ?? "0.5"),
      round_trip_percent: unknown ? null : (opts.roundTrip ?? "0.9950"),
      fee_source: feeSource,
      buy_enabled: opts.buyEnabled ?? true,
      sell_enabled: opts.sellEnabled ?? true,
      observed_at: opts.feeObservedAt ?? fetchedAt,
      ...(opts.minOrderToman !== undefined ? { min_order_toman: opts.minOrderToman } : {}),
    },
    fetched_at: fetchedAt,
    suppressed: false,
    ...(opts.reference !== undefined
      ? { reference_prices_toman: { [instrument]: opts.reference } }
      : {}),
  };
}

export const LISTED: ListedPlatform[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" },
  { slug: "talasea", name_fa: "طلاسی", data_policy: "ALLOWED" },
  { slug: "milli", name_fa: "میلی", data_policy: "ALLOWED" },
];

export const DIGIKALA: ListedPlatform = {
  slug: "digikala",
  name_fa: "دیجی‌کالا",
  data_policy: "ALLOWED",
};

export function freshIso(): string {
  return new Date(Date.now() - 30_000).toISOString(); // ۳۰ ثانیه پیش — تازه
}

export function staleIso(): string {
  return new Date(Date.now() - 10 * 60_000).toISOString(); // ۱۰ دقیقه پیش — کهنه
}

export interface SeededStore {
  listed?: ListedPlatform[];
  snapshots: Record<string, PlatformSnapshot | null>;
  updatedAt: Record<string, string | null>;
  /** payload ‏`mazane:instruments`‏ (بلیت ۷) — پرچم دروازه از گردآورنده. */
  instruments?: InstrumentListing[];
}

export function seed(store: SeededStore): void {
  setPriceSource({
    getListedPlatforms: async () => store.listed ?? LISTED,
    getSnapshot: async (slug) => store.snapshots[slug] ?? null,
    getUpdatedAt: async (slug) => store.updatedAt[slug] ?? null,
    getInstruments: async () => store.instruments ?? [],
  });
}

/**
 * فیک بلاگ عمداً «گنگ» است: هرچه seed شده را با هر وضعیتی برمی‌گرداند، تا
 * قاعده‌ی نمایش (فقط published) در لایه‌ی وب سنجیده شود، نه در فیک.
 */
export function seedBlog(posts: BlogPost[]): void {
  setBlogSource({
    listPosts: async () => posts,
    getPost: async (slug) => posts.find((post) => post.slug === slug) ?? null,
  });
}

export function seedHistory(entries: PlatformHistory[]): void {
  setHistorySource({ getPlatformHistory: async () => entries });
}

/** منبع قیمت خالی — برای تست‌هایی که فقط بلاگ را می‌سنجند. */
export function seedEmptyPrices(): void {
  seed({ listed: [], snapshots: {}, updatedAt: {}, instruments: [] });
}

/**
 * `HomePageData` از استور seed شده — **همان** `assembleHomeData` ای که
 * `loadHomeData` روی سرور صدا می‌زند، فقط با خواننده‌های دامنه‌ی تزریق‌شده،
 * پس هیچ ماژول نودی وارد گراف تست نمی‌شود.
 */
export async function homeData(
  store: SeededStore,
  extra: {
    history?: PlatformHistory[];
    posts?: BlogPost[];
    views?: ViewCounts;
    /**
     * پیکربندی نمودار از تنظیمات پنل (بلیت ۲۱) — `undefined` یعنی خواننده
     * اصلاً صدا زده نمی‌شود (همان مسیر پیش از این تیکت)؛ مقدار داده‌شده
     * (حتی `undefined` صریح از سمت خودِ خواننده) یعنی خواننده هست ولی
     * ممکن است چیزی نداشته باشد — فرود امن در `chartSeriesConfig` سنجیده
     * می‌شود.
     */
    chartPlatforms?: readonly ChartPlatformConfig[] | undefined;
  } = {},
): Promise<HomePageData> {
  seed(store);
  seedHistory(extra.history ?? []);
  seedBlog(extra.posts ?? []);
  const views = extra.views;
  const hasChartPlatformsReader = "chartPlatforms" in extra;
  return assembleHomeData({
    fetchRows,
    getPlatformHistory,
    listPublishedPosts,
    // نبودِ خواننده عمداً حالت معتبری است — همان مسیری که تا پیش از آمدن
    // شمارنده اجرا می‌شد و باید همچنان کار کند.
    ...(views === undefined ? {} : { getViewCounts: async () => views }),
    ...(hasChartPlatformsReader ? { getChartPlatforms: async () => extra.chartPlatforms } : {}),
  });
}

/**
 * فیک شمارنده‌ی بازدید — یک شمارنده‌ی درون‌حافظه‌ای که هم می‌نویسد هم
 * می‌خواند، تا مرز «ثبت بازدید ⟸ عدد خوانده‌شده» واقعاً سنجیده شود.
 */
export function seedViewCounter(initial: Record<string, number> = {}): {
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = { ...initial };
  setViewCounter({
    recordView: async (slug) => {
      counts[slug] = (counts[slug] ?? 0) + 1;
    },
    viewCounts: async () => ({ ...counts }),
  });
  return { counts };
}

/** شمارنده‌ای که همیشه می‌ترکد — برای سنجیدن «قطع منبع، خطا نیست». */
export function seedBrokenViewCounter(): void {
  setViewCounter({
    recordView: async () => {
      throw new Error("view counter down");
    },
    viewCounts: async () => {
      throw new Error("view counter down");
    },
  });
}

/**
 * فیک انبار عکس (بلیت ۲۴) — درون‌حافظه‌ای، بدون S3/sharp واقعی. هر آپلود
 * را ثبت می‌کند تا تست بتواند اسلاگ/بایت رسیده به `upload` را هم بسنجد.
 */
export function seedImageStore(
  result: Omit<UploadedImage, "objectKey"> = { width: 800, height: 600 },
): {
  uploads: { slug: string; bytes: Uint8Array; contentType: string }[];
} {
  const uploads: { slug: string; bytes: Uint8Array; contentType: string }[] = [];
  const store: ImageStore = {
    upload: async (slug, bytes, contentType) => {
      uploads.push({ slug, bytes, contentType });
      return { objectKey: `posts/${slug}/fake-hash.webp`, ...result };
    },
  };
  setImageStore(store);
  return { uploads };
}

/** انباری که همیشه می‌ترکد — برای سنجیدن «قطع انبار عکس فقط آپلود را می‌شکند». */
export function seedBrokenImageStore(): void {
  setImageStore({
    upload: async () => {
      throw new Error("image store down");
    },
  });
}

/**
 * `SlugPageData` از استور seed شده — همان `assembleSlugPage` مسیر ‎/<slug>‎.
 * `null` یعنی ۴۰۴.
 */
export async function slugPageData(slug: string): Promise<SlugPageData | null> {
  return assembleSlugPage(slug, {
    resolveSlug,
    fetchRowsForPlatforms,
    getPlatformSnapshot,
    getUpdatedAt,
    // همان خواننده‌ای که `content-data.ts` روی سرور می‌دهد: فهرست دارایی‌ها
    // از کاتالوگ می‌آید (زنده مقدم، رجیستری بیلد کف) نه مستقیم از استور.
    getInstruments: listInstruments,
  });
}

/**
 * یک سطر payload دارایی — همان شکلی که گردآورنده می‌نویسد؛ `published`
 * از قبل آنجا محاسبه شده (وب فقط می‌خواند).
 */
export function makeListing(opts: {
  slug: string;
  instrument: string;
  name_fa: string;
  supporting: string[];
  published: boolean;
  unit_fa?: string;
  purity?: string | null;
  currency?: string;
}): InstrumentListing {
  return {
    slug: opts.slug,
    instrument: opts.instrument,
    name_fa: opts.name_fa,
    unit_fa: opts.unit_fa ?? "گرم",
    purity: opts.purity ?? null,
    currency: opts.currency ?? "TOMAN",
    supporting_platform_slugs: opts.supporting,
    published: opts.published,
  };
}

/** استور سالم: هر سه سکوی فهرست‌شده تازه + گلدیکا هم در استور (ولی نه در فهرست). */
export function healthyStore(): SeededStore {
  const now = freshIso();
  return {
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        buy: 18704055,
        sell: 18517945,
        reference: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        buy: 18715300,
        sell: 18344700,
        reference: 18530000,
        fetchedAt: now,
      }),
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        buy: 18630690,
        sell: 18445310,
        reference: 18538000,
        fetchedAt: now,
      }),
      goldika: makeSnapshot({
        slug: "goldika",
        mid: 18514235,
        buy: 18736406,
        sell: 18292064,
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now, goldika: now },
  };
}

/** استور سالم + دیجی‌کالا با کارمزد UNKNOWN: فقط MID، بدون هیچ عدد کارمزد. */
export function storeWithUnknownFee(): SeededStore {
  const store = healthyStore();
  const now = freshIso();
  store.listed = [...LISTED, DIGIKALA];
  // mid دیجی‌کالا عمداً از همه‌ی مؤثرخریدها پایین‌تر است تا ثابت شود ستون
  // «قیمت خرید» عدد اسمی را جدا نمی‌کند و کارت «بهترین» نامزدش نمی‌کند.
  store.snapshots["digikala"] = makeSnapshot({
    slug: "digikala",
    mid: 18520000,
    feeSource: "UNKNOWN",
    fetchedAt: now,
  });
  store.updatedAt["digikala"] = now;
  return store;
}

/** ردیف اصلی یک سکو در HTML رندرشده (تا اولین ‎</tr>‎). */
export function rowOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<tr[^>]*data-platform="${slug}"[\\s\\S]*?</tr>`));
  if (!match) throw new Error(`ردیف ${slug} در HTML نیست`);
  return match[0];
}
