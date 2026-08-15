export type ReferenceSide = "PRICE";

export interface HistoryPoint {
  hour: string;
  value: number;
}

export interface PlatformHistory {
  platform_slug: string;
  points: HistoryPoint[];
  latest: number | null;
  side_used: ReferenceSide | null;
  has_enough_coverage?: boolean;
}

export interface HistoryQuery {
  platformSlugs: string[];
  instrument: string;
  hours: number;
  stepHours?: number;
}

export type HistoryRange = "DAILY" | "WEEKLY" | "MONTHLY";

export const HISTORY_RANGES: readonly HistoryRange[] = ["DAILY", "WEEKLY", "MONTHLY"];

export type PlatformHistoryByRange = Record<HistoryRange, PlatformHistory | null>;

export interface HistorySource {
  getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]>;
}

export type HistorySourceFactory = () => HistorySource;

let activeSource: HistorySource | null = null;
let defaultFactory: HistorySourceFactory | null = null;

export function setHistorySource(source: HistorySource): void {
  activeSource = source;
}

export function setDefaultHistorySource(factory: HistorySourceFactory): void {
  defaultFactory = factory;
}

export function resetHistorySource(): void {
  activeSource = null;
}

function source(): HistorySource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "No HistorySource registered — import from «@/lib/server/history-source» or call setHistorySource",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

function emptyHistory(platformSlug: string): PlatformHistory {
  return { platform_slug: platformSlug, points: [], latest: null, side_used: null };
}

export async function getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]> {
  try {
    return await source().getPlatformHistory(query);
  } catch (error) {
    console.error("history source unavailable; rendering empty chart", error);
    return query.platformSlugs.map(emptyHistory);
  }
}
