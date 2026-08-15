import { formatToman } from "./format";
import { COIN_PRICE_INSTRUMENTS } from "./site-content";

export type CoinPriceKey = (typeof COIN_PRICE_INSTRUMENTS)[number]["key"];

export interface CoinPriceReference {
  instrument: string;
  value: number;
  read_at: string;
}

export interface CoinPriceView {
  key: CoinPriceKey;
  label: string;
  instrument: string;
  priceToman: number | null;
  priceDisplay: string | null;
  readAt: string | null;
}

export type CoinPricesView = CoinPriceView[];

export function buildCoinPrices(
  references: readonly (CoinPriceReference | null)[],
): CoinPricesView {
  return COIN_PRICE_INSTRUMENTS.map((coin, index) => {
    const reference = references[index] ?? null;
    const price = reference?.value ?? null;
    return {
      key: coin.key,
      label: coin.label,
      instrument: coin.instrument,
      priceToman: price,
      priceDisplay: price === null ? null : formatToman(price),
      readAt: reference?.read_at ?? null,
    };
  });
}
