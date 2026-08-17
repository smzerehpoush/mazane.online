import { useEffect, useRef } from "react";

import {
  calcEventBody,
  calcEventSessionKey,
  isCalcCompleted,
  isCalcStarted,
  type CalcEvent,
  type CalcTool,
  CALC_COMPLETE_QUIET_MS,
} from "./calc-events";

const ENDPOINT = "/api/calc-event";

/**
 * ⚠️ Every failure mode of the beacon is swallowed on purpose — a browser
 * without `sendBeacon`, a blocked request, an offline tab. A throw here
 * escapes the effect and takes the calculator down with it: losing a count is
 * acceptable, breaking the tool the count measures is not.
 */
function post(tool: CalcTool, event: CalcEvent): void {
  const body = JSON.stringify(calcEventBody(tool, event));
  try {
    if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch (error) {
    console.error("calc event beacon unavailable; event not sent", error);
  }
}

function claimSessionSlot(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) !== null) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return true;
  }
  return true;
}

function emitting(tool: CalcTool, event: CalcEvent, sent: Set<CalcEvent>): void {
  if (sent.has(event)) return;
  sent.add(event);
  if (!claimSessionSlot(calcEventSessionKey(tool, event))) return;
  post(tool, event);
}

function beaconable(): boolean {
  return typeof window !== "undefined" && !navigator.webdriver;
}

export function useCalcEvents(options: {
  tool: CalcTool;
  initial: Readonly<Record<string, string>>;
  values: Readonly<Record<string, string>>;
  hasResult: boolean;
}): void {
  const { tool, initial, values, hasResult } = options;
  const sent = useRef<Set<CalcEvent>>(new Set<CalcEvent>());

  useEffect(() => {
    if (!beaconable()) return;
    if (!isCalcStarted(initial, values)) return;
    emitting(tool, "calc_start", sent.current);
  }, [tool, initial, values]);

  useEffect(() => {
    if (!beaconable()) return;
    if (!isCalcCompleted(tool, values, hasResult)) return;
    const timer = setTimeout(
      () => emitting(tool, "calc_complete", sent.current),
      CALC_COMPLETE_QUIET_MS,
    );
    return () => clearTimeout(timer);
  }, [tool, values, hasResult]);
}
