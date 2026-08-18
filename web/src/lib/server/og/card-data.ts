import "@tanstack/react-start/server-only";

import { formatFaClock } from "../../fa-number";
import { formatToman } from "../../format";
import { OG_HOME_KEY, OG_SEKEH_KEY, ogKeyForPath } from "../../og";
import { ogFootnote, ogPriceLine, type OgCard } from "../../og-card";
import type { InstrumentListing, ListedPlatform } from "../../prices";
import { priceToman } from "../../rows";
import {
  COIN_PRICE_INSTRUMENTS,
  MARKET_REFERENCE_SOURCE_NAME,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
  hero,
} from "../../site-content";
import { TOOLS, TOOLS_HUB_PATH } from "../../tools";
import { fetchRowsForPlatforms, getInstruments, getListedPlatforms } from "../price-source";
import { getReferencePrice } from "../reference-price-source";

const GOLD_18K_INSTRUMENT = "GOLD_18K";
const EMAMI_COIN_KEY = "emami";

const REFERENCE_EYEBROW = "نرخ مرجع هر گرم طلای ۱۸ عیار";
const PLATFORM_EYEBROW = "نرخ اعلامی هر گرم طلای ۱۸ عیار";
const TOOL_EYEBROW = "ماشین‌حساب تابلو";
const COMPARE_EYEBROW = "مقایسه‌ی نرخ سکوهای آنلاین";
const SEKEH_EYEBROW = "سکه امامی";
const SEKEH_TITLE = "قیمت سکه امامی، نیم سکه و ربع سکه";
const HUB_TITLE = "ابزارهای تابلو برای حساب کردن قیمت طلا";
const HUB_KEY = ogKeyForPath(TOOLS_HUB_PATH);

interface PricePoint {
  display: string | null;
  clock: string | null;
}

const NO_PRICE: PricePoint = { display: null, clock: null };

function pointFrom(value: number | null, readAt: string | null): PricePoint {
  if (value === null) return NO_PRICE;
  return { display: formatToman(value), clock: readAt === null ? null : formatFaClock(readAt) };
}

async function referencePoint(instrument: string): Promise<PricePoint> {
  const reference = await getReferencePrice({
    referenceSlug: UNION_RATE_REFERENCE_SLUG,
    instrument,
  });
  return pointFrom(reference?.value ?? null, reference?.read_at ?? null);
}

function cardOf(eyebrow: string, title: string, point: PricePoint, sourceName: string): OgCard {
  return {
    eyebrow,
    title,
    price: ogPriceLine(point.display),
    footnote: ogFootnote({ sourceName, clock: point.clock, hasPrice: point.display !== null }),
  };
}

async function homeCard(): Promise<OgCard> {
  const point = await referencePoint(UNION_RATE_INSTRUMENT);
  return cardOf(REFERENCE_EYEBROW, hero.title, point, MARKET_REFERENCE_SOURCE_NAME);
}

async function sekehCard(): Promise<OgCard> {
  const emami = COIN_PRICE_INSTRUMENTS.find((coin) => coin.key === EMAMI_COIN_KEY);
  const point = emami === undefined ? NO_PRICE : await referencePoint(emami.instrument);
  return cardOf(SEKEH_EYEBROW, SEKEH_TITLE, point, MARKET_REFERENCE_SOURCE_NAME);
}

async function hubCard(): Promise<OgCard> {
  const point = await referencePoint(UNION_RATE_INSTRUMENT);
  return cardOf(
    `${TOOL_EYEBROW} · ${REFERENCE_EYEBROW}`,
    HUB_TITLE,
    point,
    MARKET_REFERENCE_SOURCE_NAME,
  );
}

async function toolCard(question: string): Promise<OgCard> {
  const point = await referencePoint(UNION_RATE_INSTRUMENT);
  return cardOf(
    `${TOOL_EYEBROW} · ${REFERENCE_EYEBROW}`,
    question,
    point,
    MARKET_REFERENCE_SOURCE_NAME,
  );
}

async function instrumentCard(listing: InstrumentListing): Promise<OgCard> {
  if (listing.instrument !== GOLD_18K_INSTRUMENT) {
    return cardOf(
      COMPARE_EYEBROW,
      `قیمت ${listing.name_fa}`,
      NO_PRICE,
      MARKET_REFERENCE_SOURCE_NAME,
    );
  }
  const point = await referencePoint(UNION_RATE_INSTRUMENT);
  return cardOf(
    REFERENCE_EYEBROW,
    `قیمت ${listing.name_fa} در سکوهای آنلاین`,
    point,
    MARKET_REFERENCE_SOURCE_NAME,
  );
}

async function platformCard(platform: ListedPlatform): Promise<OgCard> {
  const rows = await fetchRowsForPlatforms([platform.slug]);
  const row = rows[0] ?? null;
  const point =
    row === undefined || row === null
      ? NO_PRICE
      : pointFrom(priceToman(row, GOLD_18K_INSTRUMENT), row.updatedAt);
  return cardOf(PLATFORM_EYEBROW, platform.name_fa, point, platform.name_fa);
}

/**
 * ⚠️ Every branch here has to survive a Redis/Postgres outage as a card with
 * no price, never as a throw: `/og/*.png` is fetched by Telegram and WhatsApp
 * while a person waits for a link to unfurl, and a 5xx there is a blank card
 * on the biggest organic channel the site has.
 */
export async function ogCardFor(key: string): Promise<OgCard | null> {
  if (key === OG_HOME_KEY) return homeCard();
  if (key === OG_SEKEH_KEY) return sekehCard();
  if (key === HUB_KEY) return hubCard();

  const tool = TOOLS.find((entry) => entry.href === `/${key}`);
  if (tool !== undefined) return toolCard(tool.question);

  const [instruments, platforms] = await Promise.all([getInstruments(), getListedPlatforms()]);

  const listing = instruments.find((entry) => entry.slug === key);
  if (listing !== undefined) return instrumentCard(listing);

  const platform = platforms.find((entry) => entry.slug === key);
  if (platform !== undefined) return platformCard(platform);

  return null;
}
