import type { SlugPageData } from "../../src/components/content/SlugPageView";
import type { HomePageData } from "../../src/components/tablo/HomePage";
import { listPublishedPosts, setBlogSource, type BlogPost } from "../../src/lib/blog";
import { setImageStore, type ImageStore, type UploadedImage } from "../../src/lib/images";
import { setViewCounter, type ViewCounts } from "../../src/lib/views";
import {
  getPlatformHistory,
  setHistorySource,
  type HistoryQuery,
  type PlatformHistory,
} from "../../src/lib/history";
import { assembleHomeData, assembleSlugPage } from "../../src/lib/page-data";
import { listInstruments } from "../../src/lib/catalog";
import type { ChartPlatformConfig } from "../../src/lib/site-content";
import {
  getReferencePrice,
  setReferencePriceSource,
  type ReferencePrice,
} from "../../src/lib/reference-price";
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
import { setChartConfigSource } from "../../src/lib/chart-config";
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
  feeSource?: FeeSource;
  feeObservedAt?: string;
  fetchedAt?: string;
  buyFee?: string;
  sellFee?: string;
  roundTrip?: string;
  instrument?: string;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  minOrderToman?: string;
}): PlatformSnapshot {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
  const feeSource = opts.feeSource ?? "API";
  const unknown = feeSource === "UNKNOWN";
  const instrument = opts.instrument ?? "GOLD_18K";
  const quotes: Quote[] = [quote(opts.slug, "PRICE", opts.mid, fetchedAt, instrument)];
  return {
    platform_slug: opts.slug,
    quotes,
    terms: {
      platform_slug: opts.slug,
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
  return new Date(Date.now() - 30_000).toISOString();
}

export function staleIso(): string {
  return new Date(Date.now() - 10 * 60_000).toISOString();
}

export interface SeededStore {
  listed?: ListedPlatform[];
  snapshots: Record<string, PlatformSnapshot | null>;
  updatedAt: Record<string, string | null>;
  instruments?: InstrumentListing[];
  chartPlatforms?: readonly ChartPlatformConfig[];
}

export function seed(store: SeededStore): void {
  setPriceSource({
    getListedPlatforms: async () => store.listed ?? LISTED,
    getSnapshot: async (slug) => store.snapshots[slug] ?? null,
    getUpdatedAt: async (slug) => store.updatedAt[slug] ?? null,
    getInstruments: async () => store.instruments ?? [],
  });
  // ⚠️ پیکربندی منابع نمایشی هم باید تزریق شود، وگرنه ‎/api/prices‎ (که از
  // بازطراحی به بعد برای هندسه‌ی محور به آن نیاز دارد) به ردیس **واقعی**
  // وصل می‌شود. `undefined` یعنی «تنظیمی نیست» ⟸ فهرست پیش‌فرض کد.
  setChartConfigSource({ getChartPlatforms: async () => store.chartPlatforms });
}

export function seedBlog(posts: BlogPost[]): void {
  setBlogSource({
    listPosts: async () => posts,
    getPost: async (slug) => posts.find((post) => post.slug === slug) ?? null,
  });
}

export function seedHistory(entries: PlatformHistory[]): void {
  setHistorySource({ getPlatformHistory: async () => entries });
}

export function seedHistoryByQuery(resolve: (query: HistoryQuery) => PlatformHistory[]): void {
  setHistorySource({ getPlatformHistory: async (query) => resolve(query) });
}

export function seedReferencePrice(value: ReferencePrice | null): void {
  setReferencePriceSource({ getReferencePrice: async () => value });
}

export function seedEmptyPrices(): void {
  seed({ listed: [], snapshots: {}, updatedAt: {}, instruments: [] });
}

export async function homeData(
  store: SeededStore,
  extra: {
    history?: PlatformHistory[];
    posts?: BlogPost[];
    views?: ViewCounts;
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
    ...(views === undefined ? {} : { getViewCounts: async () => views }),
    ...(hasChartPlatformsReader ? { getChartPlatforms: async () => extra.chartPlatforms } : {}),
  });
}

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

export function seedBrokenImageStore(): void {
  setImageStore({
    upload: async () => {
      throw new Error("image store down");
    },
  });
}

export async function slugPageData(slug: string): Promise<SlugPageData | null> {
  return assembleSlugPage(slug, {
    resolveSlug,
    fetchRowsForPlatforms,
    getPlatformSnapshot,
    getUpdatedAt,
    getInstruments: listInstruments,
    getPlatformHistory,
    getReferencePrice,
  });
}

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

export function healthyStore(): SeededStore {
  const now = freshIso();
  return {
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        fetchedAt: now,
      }),
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        fetchedAt: now,
      }),
      goldika: makeSnapshot({
        slug: "goldika",
        mid: 18514235,
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now, goldika: now },
  };
}

export function storeWithUnknownFee(): SeededStore {
  const store = healthyStore();
  const now = freshIso();
  store.listed = [...LISTED, DIGIKALA];
  store.snapshots["digikala"] = makeSnapshot({
    slug: "digikala",
    mid: 18520000,
    feeSource: "UNKNOWN",
    fetchedAt: now,
  });
  store.updatedAt["digikala"] = now;
  return store;
}

export function rowOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<tr[^>]*data-platform="${slug}"[\\s\\S]*?</tr>`));
  if (!match) throw new Error(`ردیف ${slug} در HTML نیست`);
  return match[0];
}
