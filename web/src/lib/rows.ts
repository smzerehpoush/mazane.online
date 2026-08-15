/**
 * ⚠️ From now on every platform has **one** number: "price", before any
 * fee. The effective buy/sell price is no longer stored, computed, or
 * shown — fee comes separately in `terms`, and no layer multiplies it
 * into the price. If it's ever needed again, change `` first.
 */
import { listPlatforms } from "./catalog";
import {
  getPlatformSnapshot,
  getUpdatedAt,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
} from "./prices";

export interface Row {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
}

export function findQuote(quotes: Quote[], instrument: string = "GOLD_18K"): Quote | null {
  return quotes.find((q) => q.side === "PRICE" && q.instrument === instrument) ?? null;
}

export function priceToman(row: Row, instrument: string = "GOLD_18K"): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, instrument)?.price_toman ?? null;
}

export function hasUnknownFee(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.fee_source === "UNKNOWN";
}

function feeNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function buyFeePercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.buy_fee_percent);
}

export function sellFeePercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.sell_fee_percent);
}

export function roundTripPercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.round_trip_percent);
}

export function isBuyOpen(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.buy_enabled;
}

export function isSellOpen(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.sell_enabled;
}

/**
 * ⚠️ No monetization field is ever a sort input — a code-level guard in
 * `tests/sponsored-links.test.tsx` flags even their names red in this file.
 */
export function compareByPrice(instrument: string = "GOLD_18K") {
  return (a: Row, b: Row): number =>
    (priceToman(a, instrument) ?? Number.POSITIVE_INFINITY) -
    (priceToman(b, instrument) ?? Number.POSITIVE_INFINITY);
}

export async function fetchRows(): Promise<Row[]> {
  return rowsOf(await listPlatforms());
}

export async function fetchRowsForPlatforms(slugs: string[]): Promise<Row[]> {
  const wanted = new Set(slugs);
  const platforms = (await listPlatforms()).filter((p) => wanted.has(p.slug));
  return rowsOf(platforms);
}

async function rowsOf(platforms: ListedPlatform[]): Promise<Row[]> {
  return Promise.all(
    platforms.map(async (platform) => {
      const [snapshot, updatedAt] = await Promise.all([
        getPlatformSnapshot(platform.slug),
        getUpdatedAt(platform.slug),
      ]);
      return { platform, snapshot, updatedAt };
    }),
  );
}
