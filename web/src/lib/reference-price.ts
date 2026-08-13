/**
 * ⚠️ این عدد **مرجع قیمت** است، نه قیمت هیچ سکویی — در هیچ محاسبه‌ای شرکت
 * نمی‌کند و به‌عنوان قیمت هیچ سکویی نمایش داده نمی‌شود (:
 * بدون میانگین بین‌سکویی، هر عدد به یک منبع نام‌برده منتسب است). برچسب
 * نمایشی «نرخ اتحادیه» روی این عدد تصمیم ثبت‌شده‌ی مالک است — سند
 * `adr/0001-etehadieh-label-on-talair-number.md`.
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
      "هیچ ReferencePriceSource ثبت نشده — از «@/lib/server/reference-price-source» بخوان یا setReferencePriceSource صدا بزن",
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
