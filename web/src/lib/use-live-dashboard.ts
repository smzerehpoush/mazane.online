/**
 * ⚠️ This hook itself never touches the DOM and renders nothing — only
 * state. Putting values onto nodes is `DashboardLive`'s job.
 */
import { useEffect, useRef, useState } from "react";

import type { LiveDashboard, LivePricesPayload } from "./live-update";

export const POLL_INTERVAL_MS = 30_000;

export interface LiveDashboardState {
  data: LiveDashboard | null;
  failed: boolean;
  tick: number;
  refreshNow: () => void;
}

const MIN_FIRST_DELAY_MS = 1_000;

/**
 * ⚠️ Why this matters: the wick's phase is locked to the **server**'s
 * `updatedAt`, but if the first fetch happens 30 seconds after mount, the
 * two never line up. A page hydrated 5 seconds after `updatedAt` has its
 * wick finish 5 seconds **earlier** than the data arrives, every cycle, and
 * because it's `infinite` it just refills — the error is never corrected,
 * and ("the wick finishes exactly when the data arrives") stays violated
 * forever. By setting the first fetch to the remainder of that same cycle,
 * both clocks land on one phase and stay in step after that.
 */
export function firstDelayMs(updatedAt: string | null, nowMs: number = Date.now()): number {
  if (updatedAt === null) return POLL_INTERVAL_MS;
  const elapsed = nowMs - new Date(updatedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return POLL_INTERVAL_MS;
  return Math.max(MIN_FIRST_DELAY_MS, POLL_INTERVAL_MS - (elapsed % POLL_INTERVAL_MS));
}

/**
 * ⚠️ `initialUpdatedAt` is the server-rendered data's timestamp and
 * **only** sets the phase of the first fetch: polling must sync with the
 * collector's cycle, not the moment of hydration. It's deliberately not
 * read from internal `data`, because until the first successful fetch,
 * that's the only time we have.
 */
export function useLiveDashboard(initialUpdatedAt: string | null = null): LiveDashboardState {
  const [data, setData] = useState<LiveDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll(): Promise<void> {
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const payload = (await response.json()) as LivePricesPayload;
        if (cancelled) return;
        if (payload.dashboard !== undefined) {
          setData(payload.dashboard);
          setTick((value) => value + 1);
        }
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    function schedule(delayMs: number = POLL_INTERVAL_MS): void {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, delayMs);
    }

    async function run(): Promise<void> {
      if (document.visibilityState === "hidden") return;
      await poll();
      if (!cancelled) schedule();
    }

    fetchRef.current = () => {
      void (async () => {
        await poll();
        if (!cancelled) schedule();
      })();
    };

    function onVisibilityChange(): void {
      if (document.visibilityState !== "visible") {
        window.clearTimeout(timer);
        return;
      }
      void run();
    }

    // ⚠️ The first fetch is never "right now" — the server-rendered data is
    // fresh, and an immediate fetch is just one extra request to origin.
    // But it isn't a full interval either: it lands on the remainder of the
    // collector's cycle to stay in phase with the wick (explained in
    // `firstDelayMs`).
    schedule(firstDelayMs(initialUpdatedAt));
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // This is the server value and does not change during the page lifetime,
    // so this effectively runs once; if it ever changes, resetting the timer
    // is the correct behavior, not a side effect.
  }, [initialUpdatedAt]);

  return { data, failed, tick, refreshNow: () => fetchRef.current() };
}
