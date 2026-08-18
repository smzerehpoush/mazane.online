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
