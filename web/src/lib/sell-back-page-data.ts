import { createServerFn } from "@tanstack/react-start";

import { getReferencePrice } from "./server/reference-price-source";
import {
  MARKET_REFERENCE_SOURCE_NAME,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
} from "./site-content";

export interface SellBackPageData {
  pricePerGram: number | null;
  referenceName: string;
  readAt: string | null;
  generated_at: string;
}

export const loadSellBackPageData = createServerFn({ method: "GET" }).handler(
  async (): Promise<SellBackPageData> => {
    const reference = await getReferencePrice({
      referenceSlug: UNION_RATE_REFERENCE_SLUG,
      instrument: UNION_RATE_INSTRUMENT,
    });
    return {
      pricePerGram: reference?.value ?? null,
      referenceName: MARKET_REFERENCE_SOURCE_NAME,
      readAt: reference?.read_at ?? null,
      generated_at: new Date().toISOString(),
    };
  },
);
