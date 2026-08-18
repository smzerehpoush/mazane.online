export const MESGHAL_GRAMS = 4.6083;
export const ABSHODE_FINENESS = 705;
export const GOLD_18K_FINENESS = 750;

/**
 * ⚠️ Both directions divide and multiply by this one constant, never by a
 * re-derived chain. A مظنه converted to a gram rate and back must land on the
 * number the visitor typed, or the page contradicts itself on screen.
 */
export const MESGHAL_IN_18K_GRAMS = MESGHAL_GRAMS * (ABSHODE_FINENESS / GOLD_18K_FINENESS);

export function gramRateFromMazane(mazaneToman: number): number | null {
  if (!Number.isFinite(mazaneToman) || mazaneToman <= 0) return null;
  return Math.round(mazaneToman / MESGHAL_IN_18K_GRAMS);
}

export function mazaneFromGramRate(gramRateToman: number): number | null {
  if (!Number.isFinite(gramRateToman) || gramRateToman <= 0) return null;
  return Math.round(gramRateToman * MESGHAL_IN_18K_GRAMS);
}

export const MAZANE_DIRECTIONS = ["mazane-to-gram", "gram-to-mazane"] as const;

export type MazaneDirection = (typeof MAZANE_DIRECTIONS)[number];

export function convertMazane(direction: MazaneDirection, amountToman: number): number | null {
  return direction === "mazane-to-gram"
    ? gramRateFromMazane(amountToman)
    : mazaneFromGramRate(amountToman);
}
