import { formatMinutesAgoFa, isStale, minutesSince } from "./format";

export interface LivePriceRow {
  platform_slug: string;
  price_toman: number | null;
  price_display: string | null;
  updated_at: string | null;
}

/**
 * ⚠️ Especially `rail_percent`: position on the axis depends on the whole
 * set's min/max, so it changes on every tick. If the client computed it
 * itself, it would both break and give us two implementations of one piece
 * of geometry that could diverge. The client just drops the number into
 * `style.right`.
 */
export interface LiveDashboardSource {
  slug: string;
  price_toman: number | null;
  price_display: string | null;
  rail_percent: number | null;
  stem_long: boolean;
  updated_at: string | null;
}

export interface LiveDashboard {
  sources: LiveDashboardSource[];
  max_display: string | null;
  min_display: string | null;
  spread_display: string | null;
  reference_percent: number | null;
  updated_at: string | null;
  /**
   * ⚠️ Comes as a ready-made string, and the client doesn't format it —
   * the same rule this whole payload is built on. Without this field, the
   * "last updated" label would freeze at the server's render time
   * while the prices next to it changed every 30 seconds — meaning the
   * exact label whose job is to state the data's age would be lying.
   */
  updated_at_display: string | null;
}

export interface LivePricesPayload {
  generated_at: string;
  rows: LivePriceRow[];
  dashboard?: LiveDashboard;
}

export interface LiveRowDomState {
  priceText: string;
  updatedAtIso: string | null;
  updatedText: string;
  staleText: string;
}

export const STALE_SUFFIX_FA = " (کهنه)";

export function nextRowDomState(
  current: LiveRowDomState,
  update: LivePriceRow | undefined,
  nowMs: number,
): LiveRowDomState {
  const priceText =
    update !== undefined && update.price_display !== null
      ? update.price_display
      : current.priceText;
  const updatedAtIso = update?.updated_at ?? current.updatedAtIso;
  if (updatedAtIso === null) {
    return { ...current, priceText };
  }
  const minutes = minutesSince(updatedAtIso, nowMs);
  return {
    priceText,
    updatedAtIso,
    updatedText: formatMinutesAgoFa(minutes),
    staleText: isStale(minutes) ? STALE_SUFFIX_FA : "",
  };
}

export const RATE_CARD_POLL_SECONDS = 30;

export interface RateCardCountdownTick {
  secondsRemaining: number;
  shouldFetch: boolean;
}

export function nextRateCardCountdown(
  secondsRemaining: number,
  isStaleNow: boolean,
): RateCardCountdownTick {
  if (isStaleNow) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: false };
  }
  if (secondsRemaining <= 0) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: true };
  }
  return { secondsRemaining: secondsRemaining - 1, shouldFetch: false };
}
