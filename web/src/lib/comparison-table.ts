/**
 * ⚠️ This module decides the order and the visibility of every row in the
 * comparison table, so it is bound by the same rule as `lib/rows.ts`: no
 * monetization field may ever be read here, not even to break a tie. The
 * final tie-break is the platform slug precisely because it cannot be sold.
 * `tests/ranking-neutrality.test.tsx` replays all five sorts and all sixteen
 * filter subsets against two stores that differ in nothing but which platform
 * pays us, and `tests/sponsored-links.test.tsx` greps this file at the source
 * level for the names of those fields.
 */
import { isStale, minutesSince } from "./format";
import { buyFeePercent, priceToman, roundTripPercent, sellFeePercent, type Row } from "./rows";

export const COMPARISON_SORTS = [
  "price",
  "buy-fee",
  "sell-fee",
  "round-trip",
  "min-order",
] as const;
export type ComparisonSort = (typeof COMPARISON_SORTS)[number];

export const COMPARISON_FILTERS = [
  "cheap-round-trip",
  "delivery",
  "declared-fee",
  "fresh",
] as const;
export type ComparisonFilter = (typeof COMPARISON_FILTERS)[number];

export interface ComparisonView {
  sort: ComparisonSort;
  filters: readonly ComparisonFilter[];
}

export const DEFAULT_COMPARISON_SORT: ComparisonSort = "price";

export const DEFAULT_COMPARISON_VIEW: ComparisonView = {
  sort: DEFAULT_COMPARISON_SORT,
  filters: [],
};

export const SORT_LABELS_FA: Record<ComparisonSort, string> = {
  price: "قیمت",
  "buy-fee": "کارمزد خرید",
  "sell-fee": "کارمزد فروش",
  "round-trip": "هزینه‌ی رفت‌وبرگشت",
  "min-order": "حداقل خرید",
};

/**
 * ⚠️ The round-trip chip is labelled «میانه یا کمتر», not «زیر میانه». The
 * predicate is `value <= median`, so on the live payload — where every platform
 * publishes the identical round-trip — every row it shows sits exactly *at* the
 * median, and «زیر» was untrue of every single one of them.
 */
export const FILTER_LABELS_FA: Record<ComparisonFilter, string> = {
  "cheap-round-trip": "رفت‌وبرگشت میانه یا کمتر",
  delivery: "تحویل فیزیکی تأییدشده",
  "declared-fee": "کارمزد اعلام‌شده",
  fresh: "داده‌ی تازه",
};

/**
 * ⚠️ Three different reasons a control can be off, and swapping them is a lie
 * the typechecker cannot catch. `*_UNAVAILABLE_FA` says the platforms in this
 * table published nothing — it is scoped to «سکوهایی که همین حالا قیمت دارند»
 * because that is the only set we actually looked at. `*_NO_PRICES_FA` is the
 * Redis/Postgres outage: the platforms did publish, we cannot read it, and
 * saying «هیچ سکویی اعلام نکرده است» there is a false claim about a third
 * party. `FILTER_NO_EFFECT_FA` is the opposite end — everybody qualifies, so
 * the filter would hide nobody.
 */
export const SORT_UNAVAILABLE_FA: Record<ComparisonSort, string> = {
  price: "میان سکوهای این جدول قیمتی در دست نداریم",
  "buy-fee":
    "میان سکوهایی که همین حالا قیمت دارند، هیچ‌کدام کارمزد خرید خود را عمومی اعلام نکرده‌اند",
  "sell-fee":
    "میان سکوهایی که همین حالا قیمت دارند، هیچ‌کدام کارمزد فروش خود را عمومی اعلام نکرده‌اند",
  "round-trip":
    "میان سکوهایی که همین حالا قیمت دارند، هیچ‌کدام هزینه‌ی رفت‌وبرگشت خود را عمومی اعلام نکرده‌اند",
  "min-order": "حداقل خرید هیچ‌کدام از سکوهای این جدول را هنوز جمع نکرده‌ایم",
};

export const FILTER_UNAVAILABLE_FA: Record<ComparisonFilter, string> = {
  "cheap-round-trip":
    "میان سکوهایی که همین حالا قیمت دارند، هیچ‌کدام هزینه‌ی رفت‌وبرگشت خود را عمومی اعلام نکرده‌اند",
  delivery:
    "میان سکوهایی که همین حالا قیمت دارند، تحویل فیزیکی هیچ‌کدام را هنوز بررسی و تأیید نکرده‌ایم",
  "declared-fee":
    "میان سکوهایی که همین حالا قیمت دارند، هیچ‌کدام کارمزد خود را عمومی اعلام نکرده‌اند",
  fresh: "داده‌ی هیچ‌کدام از سکوهای این جدول در دقایق اخیر تازه نشده است",
};

export const SORT_NO_PRICES_FA =
  "همین حالا قیمتی از سکوها در دست نداریم، پس این ترتیب ساخته نمی‌شود";

export const FILTER_NO_PRICES_FA =
  "همین حالا قیمتی از سکوها در دست نداریم، پس این فیلتر چیزی را جدا نمی‌کند";

export const FILTER_NO_EFFECT_FA =
  "همه‌ی سکوهای قیمت‌دار این جدول این شرط را دارند، پس این فیلتر چیزی را کنار نمی‌گذارد";

export function minOrderToman(row: Row): number | null {
  const value = row.platform.profile?.min_buy_toman ?? null;
  if (value === null) return null;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function hasDeclaredFee(row: Row): boolean {
  if (row.snapshot === null || row.snapshot.terms.fee_source === "UNKNOWN") return false;
  return (
    buyFeePercent(row) !== null || sellFeePercent(row) !== null || roundTripPercent(row) !== null
  );
}

export function hasConfirmedDelivery(row: Row): boolean {
  return (row.platform.delivery_note_fa ?? null) !== null;
}

export function isFresh(row: Row, nowMs: number): boolean {
  if (row.updatedAt === null) return false;
  return !isStale(minutesSince(row.updatedAt, nowMs));
}

export function metricOf(row: Row, sort: ComparisonSort, instrument: string): number | null {
  switch (sort) {
    case "price":
      return priceToman(row, instrument);
    case "buy-fee":
      return buyFeePercent(row);
    case "sell-fee":
      return sellFeePercent(row);
    case "round-trip":
      return roundTripPercent(row);
    case "min-order":
      return minOrderToman(row);
  }
}

/**
 * ⚠️ The tie-break chain, in order: the sorted metric, then the quoted price,
 * then the slug. A row whose metric is undisclosed always sinks below every
 * row that disclosed one — an unpublished fee must never be able to read as
 * a cheap fee.
 */
export function compareByMetric(sort: ComparisonSort, instrument: string) {
  return (a: Row, b: Row): number => {
    const left = metricOf(a, sort, instrument);
    const right = metricOf(b, sort, instrument);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    const priceLeft = priceToman(a, instrument) ?? Number.POSITIVE_INFINITY;
    const priceRight = priceToman(b, instrument) ?? Number.POSITIVE_INFINITY;
    if (priceLeft !== priceRight) return priceLeft - priceRight;
    return a.platform.slug < b.platform.slug ? -1 : a.platform.slug > b.platform.slug ? 1 : 0;
  };
}

/**
 * ⚠️ The threshold behind the «رفت‌وبرگشت میانه یا کمتر» filter must be read from
 * the whole priced set once, **before** any filter runs. Recomputing it on the
 * already-filtered rows would move the bar every time another filter is
 * toggled, so the same platform would drop in and out for no visible reason.
 */
export function medianRoundTrip(rows: readonly Row[]): number | null {
  const values = rows
    .map(roundTripPercent)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle] ?? null;
  const lower = values[middle - 1];
  const upper = values[middle];
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2;
}

function filterPredicate(
  filter: ComparisonFilter,
  nowMs: number,
  median: number | null,
): (row: Row) => boolean {
  switch (filter) {
    case "cheap-round-trip":
      return (row) => {
        const value = roundTripPercent(row);
        return median !== null && value !== null && value <= median;
      };
    case "delivery":
      return hasConfirmedDelivery;
    case "declared-fee":
      return hasDeclaredFee;
    case "fresh":
      return (row) => isFresh(row, nowMs);
  }
}

export interface SortControl {
  key: ComparisonSort;
  label: string;
  active: boolean;
  available: boolean;
  reasonFa: string | null;
}

export interface FilterControl {
  key: ComparisonFilter;
  label: string;
  active: boolean;
  available: boolean;
  reasonFa: string | null;
}

export interface ComparisonModel {
  sort: ComparisonSort;
  filters: readonly ComparisonFilter[];
  sorts: readonly SortControl[];
  filterControls: readonly FilterControl[];
  visible: readonly Row[];
  unpriced: readonly Row[];
  hiddenCount: number;
  medianRoundTrip: number | null;
}

export function normalizeComparisonSort(value: unknown): ComparisonSort {
  return COMPARISON_SORTS.includes(value as ComparisonSort)
    ? (value as ComparisonSort)
    : DEFAULT_COMPARISON_SORT;
}

export function normalizeComparisonFilters(value: unknown): ComparisonFilter[] {
  const raw =
    typeof value === "string" ? value.split(",") : Array.isArray(value) ? value.map(String) : [];
  return COMPARISON_FILTERS.filter((filter) => raw.includes(filter));
}

export function comparisonViewFromSearch(search: {
  sort?: string | undefined;
  filter?: string | undefined;
}): ComparisonView {
  return {
    sort: normalizeComparisonSort(search.sort),
    filters: normalizeComparisonFilters(search.filter),
  };
}

export function comparisonSearchOf(view: ComparisonView): {
  sort?: ComparisonSort;
  filter?: string;
} {
  return {
    ...(view.sort === DEFAULT_COMPARISON_SORT ? {} : { sort: view.sort }),
    ...(view.filters.length === 0 ? {} : { filter: [...view.filters].join(",") }),
  };
}

export function comparisonHref(view: ComparisonView, path: string): string {
  const search = comparisonSearchOf(view);
  const params = new URLSearchParams();
  if (search.sort !== undefined) params.set("sort", search.sort);
  if (search.filter !== undefined) params.set("filter", search.filter);
  const query = params.toString();
  return query.length === 0 ? path : `${path}?${query}`;
}

export function toggledFilters(
  filters: readonly ComparisonFilter[],
  filter: ComparisonFilter,
): ComparisonFilter[] {
  return filters.includes(filter)
    ? filters.filter((item) => item !== filter)
    : COMPARISON_FILTERS.filter((item) => item === filter || filters.includes(item));
}

/**
 * ⚠️ A control that cannot change what the reader sees is never offered as if
 * it could: an unavailable sort or filter is rendered disabled next to the
 * sentence that says why, and `ComparisonControls` prints that sentence as
 * ordinary visible text, not only in a `title`. "Cannot change" cuts both
 * ways — a filter that hides nobody is as dead as one that hides everybody,
 * so `available` needs a row on each side of the predicate.
 */
export function buildComparisonModel({
  rows,
  instrument,
  nowMs,
  view,
}: {
  rows: readonly Row[];
  instrument: string;
  nowMs: number;
  view: ComparisonView;
}): ComparisonModel {
  const priced = rows.filter((row) => priceToman(row, instrument) !== null);
  const unpriced = rows
    .filter((row) => priceToman(row, instrument) === null)
    .sort((a, b) =>
      a.platform.slug < b.platform.slug ? -1 : a.platform.slug > b.platform.slug ? 1 : 0,
    );
  const median = medianRoundTrip(priced);
  const noPrices = priced.length === 0;

  const sorts: SortControl[] = COMPARISON_SORTS.map((key) => {
    const available = !noPrices && priced.some((row) => metricOf(row, key, instrument) !== null);
    return {
      key,
      label: SORT_LABELS_FA[key],
      active: false,
      available,
      reasonFa: available ? null : noPrices ? SORT_NO_PRICES_FA : SORT_UNAVAILABLE_FA[key],
    };
  });

  const filterControls: FilterControl[] = COMPARISON_FILTERS.map((key) => {
    const passing = priced.filter(filterPredicate(key, nowMs, median)).length;
    const available = !noPrices && passing > 0 && passing < priced.length;
    return {
      key,
      label: FILTER_LABELS_FA[key],
      active: false,
      available,
      reasonFa: available
        ? null
        : noPrices
          ? FILTER_NO_PRICES_FA
          : passing === 0
            ? FILTER_UNAVAILABLE_FA[key]
            : FILTER_NO_EFFECT_FA,
    };
  });

  const sortAvailable = sorts.find((control) => control.key === view.sort)?.available === true;
  const sort = sortAvailable ? view.sort : DEFAULT_COMPARISON_SORT;
  const filters = view.filters.filter(
    (key) => filterControls.find((control) => control.key === key)?.available === true,
  );

  for (const control of sorts) control.active = control.key === sort;
  for (const control of filterControls) control.active = filters.includes(control.key);

  const visible = priced
    .filter((row) => filters.every((key) => filterPredicate(key, nowMs, median)(row)))
    .sort(compareByMetric(sort, instrument));

  return {
    sort,
    filters,
    sorts,
    filterControls,
    visible,
    unpriced,
    hiddenCount: priced.length - visible.length,
    medianRoundTrip: median,
  };
}
