import { describe, expect, it } from "vitest";

import { firstDelayMs, POLL_INTERVAL_MS } from "../src/lib/use-live-dashboard";

const BASE = Date.parse("2026-08-11T12:00:00.000Z");
const iso = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString();

describe("firstDelayMs — the first fetch lands on the collector's cycle", () => {
  it("5 seconds after data ⟸ waits 25 seconds, not 30", () => {
    expect(firstDelayMs(iso(0), BASE + 5_000)).toBe(25_000);
  });

  it("20 seconds after data ⟸ waits 10 seconds", () => {
    expect(firstDelayMs(iso(0), BASE + 20_000)).toBe(10_000);
  });

  it("wraps past cycles: 65 seconds ⟸ 25 seconds", () => {
    expect(firstDelayMs(iso(0), BASE + 65_000)).toBe(25_000);
  });

  it("exactly on the boundary ⟸ one full interval, not zero", () => {
    expect(firstDelayMs(iso(0), BASE + POLL_INTERVAL_MS)).toBe(POLL_INTERVAL_MS);
  });

  it("never returns zero or negative — a fetch \"on mount\" is forbidden", () => {
    expect(firstDelayMs(iso(0), BASE + POLL_INTERVAL_MS - 1)).toBe(1_000);
    for (let elapsed = 0; elapsed < POLL_INTERVAL_MS; elapsed += 137) {
      expect(firstDelayMs(iso(0), BASE + elapsed)).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("never exceeds one full interval", () => {
    for (let elapsed = 0; elapsed < 3 * POLL_INTERVAL_MS; elapsed += 311) {
      expect(firstDelayMs(iso(0), BASE + elapsed)).toBeLessThanOrEqual(POLL_INTERVAL_MS);
    }
  });

  it("without a server time ⟸ the old behavior (one full interval)", () => {
    expect(firstDelayMs(null, BASE)).toBe(POLL_INTERVAL_MS);
  });

  it("invalid time ⟸ one full interval, not NaN", () => {
    expect(firstDelayMs("نه‌یک‌تاریخ", BASE)).toBe(POLL_INTERVAL_MS);
  });

  it("the user's clock running behind ⟸ one full interval, not an early fetch", () => {
    expect(firstDelayMs(iso(10_000), BASE)).toBe(POLL_INTERVAL_MS);
  });
});
