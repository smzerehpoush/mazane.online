import type { PlatformProfile } from "./platform-profile";

export type Side = "PRICE";
export type FeeSource = "API" | "MANUAL" | "IMPLIED" | "UNKNOWN";
export type DataPolicy = "ALLOWED" | "RESTRICTED" | "PERMISSION_PENDING" | "BLOCKED";
export type MarketModel = "OTC" | "ORDER_BOOK";

export interface ListedPlatform {
  slug: string;
  name_fa: string;
  data_policy: DataPolicy;
  market_model?: MarketModel;
  name_en?: string | null;
  website_url?: string | null;
  legal_entity?: string | null;
  founded_year_jalali?: number | null;
  delivery_note_fa?: string | null;
  /**
   * ⚠️ Absent from `REGISTRY_PLATFORMS` on purpose: the profile is owned by
   * the admin panel and reaches this type only through the live
   * `tablo:listed` payload. When Redis is down the static registry takes
   * over and every profile field is simply missing, which the platform page
   * renders as "not collected yet" rather than as an error.
   */
  profile?: PlatformProfile | null;
  /**
   * ⚠️ (non-negotiable requirement): these two fields are **never**
   * sorting inputs — groupRows/editorialPick only read price and the
   * collector's fee; tested in tests/sponsored-links.test.tsx.
   */
  referral_url?: string | null;
  referral_param?: string | null;
}

export interface InstrumentListing {
  slug: string;
  instrument: string;
  name_fa: string;
  unit_fa: string;
  purity: string | null;
  currency: string;
  supporting_platform_slugs: string[];
  published: boolean;
}

export interface Quote {
  platform_slug: string;
  instrument: string;
  side: Side;
  price_toman: number;
  raw_value: string;
  raw_scale: string;
  fetched_at: string;
}

export interface PlatformTerms {
  platform_slug: string;
  buy_fee_percent: string | null;
  sell_fee_percent: string | null;
  round_trip_percent: string | null;
  fee_source: FeeSource;
  buy_enabled: boolean;
  sell_enabled: boolean;
  observed_at: string;
}

export interface PlatformSnapshot {
  platform_slug: string;
  quotes: Quote[];
  terms: PlatformTerms;
  fetched_at: string;
  suppressed: boolean;
}

export interface PriceSource {
  getListedPlatforms(): Promise<ListedPlatform[]>;
  getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null>;
  getUpdatedAt(platformSlug: string): Promise<string | null>;
  getInstruments?(): Promise<InstrumentListing[]>;
}

export type PriceSourceFactory = () => PriceSource;

let activeSource: PriceSource | null = null;
let defaultFactory: PriceSourceFactory | null = null;

export function setPriceSource(source: PriceSource): void {
  activeSource = source;
}

export function setDefaultPriceSource(factory: PriceSourceFactory): void {
  defaultFactory = factory;
}

export function resetPriceSource(): void {
  activeSource = null;
}

function source(): PriceSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "No PriceSource registered — import from «@/lib/server/price-source» or call setPriceSource",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

export async function getListedPlatforms(): Promise<ListedPlatform[]> {
  return source().getListedPlatforms();
}

export async function getPlatformSnapshot(platformSlug: string): Promise<PlatformSnapshot | null> {
  return source().getSnapshot(platformSlug);
}

export async function getUpdatedAt(platformSlug: string): Promise<string | null> {
  return source().getUpdatedAt(platformSlug);
}

export async function getInstruments(): Promise<InstrumentListing[]> {
  const active = source();
  return active.getInstruments === undefined ? [] : active.getInstruments();
}
