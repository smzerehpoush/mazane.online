import { createServerFn } from "@tanstack/react-start";

import { calculateCoinBubble, type BubbleView } from "./bubble";
import { buildCoinPrices, type CoinPricesView } from "./coin-prices";
import { getReferencePrice } from "./server/reference-price-source";
import {
  COIN_PRICE_INSTRUMENTS,
  EMAMI_COIN_PURE_GOLD_GRAMS,
  OUNCE_REFERENCE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
  USD_REFERENCE_INSTRUMENT,
} from "./site-content";

export interface SekehPageData {
  coins: CoinPricesView;
  emamiBubble: BubbleView | null;
  generated_at: string;
}

export const loadSekehData = createServerFn({ method: "GET" }).handler(
  async (): Promise<SekehPageData> => {
    const [coinReferences, ounceReference, usdReference] = await Promise.all([
      Promise.all(
        COIN_PRICE_INSTRUMENTS.map((coin) =>
          getReferencePrice({
            referenceSlug: UNION_RATE_REFERENCE_SLUG,
            instrument: coin.instrument,
          }),
        ),
      ),
      getReferencePrice({
        referenceSlug: UNION_RATE_REFERENCE_SLUG,
        instrument: OUNCE_REFERENCE_INSTRUMENT,
      }),
      getReferencePrice({
        referenceSlug: UNION_RATE_REFERENCE_SLUG,
        instrument: USD_REFERENCE_INSTRUMENT,
      }),
    ]);

    const coins = buildCoinPrices(coinReferences);
    return {
      coins,
      emamiBubble: calculateCoinBubble({
        coinPriceToman: coins.find((coin) => coin.key === "emami")?.priceToman ?? null,
        pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
        ounceUsd: ounceReference?.value ?? null,
        usdToman: usdReference?.value ?? null,
      }),
      generated_at: new Date().toISOString(),
    };
  },
);
