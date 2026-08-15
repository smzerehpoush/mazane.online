/**
 * ⚠️ This number is the **reference price**, not any platform's price — it
 * takes no part in any calculation and is never displayed as any
 * platform's price (:
 * with no cross-platform average, every number is attributed to one named
 * source). The "union rate" display label on this number is the owner's
 * recorded decision — see `adr/0001-etehadieh-label-on-talair-number.md`.
 */

export interface ReferencePriceQuery {
  referenceSlug: string;
  instrument: string;
}

export interface ReferencePrice {
  reference_slug: string;
  instrument: string;
  value: number;
  read_at: string;
}

export interface ReferencePriceSource {
  getReferencePrice(query: ReferencePriceQuery): Promise<ReferencePrice | null>;
}

export type ReferencePriceSourceFactory = () => ReferencePriceSource;

let activeSource: ReferencePriceSource | null = null;
let defaultFactory: ReferencePriceSourceFactory | null = null;

export function setReferencePriceSource(source: ReferencePriceSource): void {
  activeSource = source;
}

export function setDefaultReferencePriceSource(factory: ReferencePriceSourceFactory): void {
  defaultFactory = factory;
}

export function resetReferencePriceSource(): void {
  activeSource = null;
}

function source(): ReferencePriceSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "No ReferencePriceSource registered — import from «@/lib/server/reference-price-source» or call setReferencePriceSource",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

export async function getReferencePrice(
  query: ReferencePriceQuery,
): Promise<ReferencePrice | null> {
  try {
    return await source().getReferencePrice(query);
  } catch (error) {
    console.error("reference price source unavailable; hiding union rate bar", error);
    return null;
  }
}
