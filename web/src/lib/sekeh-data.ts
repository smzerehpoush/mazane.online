import { createServerFn } from "@tanstack/react-start";

import { buildCoinPrices, type CoinPricesView } from "./coin-prices";
import { getReferencePrice } from "./server/reference-price-source";
import { COIN_PRICE_INSTRUMENTS, UNION_RATE_REFERENCE_SLUG } from "./site-content";

export interface SekehPageData {
  coins: CoinPricesView;
  generated_at: string;
}

export const loadSekehData = createServerFn({ method: "GET" }).handler(
  async (): Promise<SekehPageData> => ({
    coins: buildCoinPrices(
      await Promise.all(
        COIN_PRICE_INSTRUMENTS.map((coin) =>
          getReferencePrice({
            referenceSlug: UNION_RATE_REFERENCE_SLUG,
            instrument: coin.instrument,
          }),
        ),
      ),
    ),
    generated_at: new Date().toISOString(),
  }),
);
