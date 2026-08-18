/**
 * ⚠️ **Why the beacon fires from the browser, not from a loader:** the pages
 * carrying a calculator are cached at Arvan's edge, so anything counted while
 * the HTML is produced measures cache misses rather than people — the reason
 * spelled out at the top of `lib/views.ts`. Only the browser knows that a
 * calculation actually happened.
 *
 * ⚠️ **Nothing but the tool slug and the event name may leave the browser.**
 * The weights, wages, percentages and totals the visitor types never travel
 * and are never stored: `calcEventBody` is the whole payload, and widening it
 * to carry an input or a result would turn a counter into a data collection.
 *
 * ⚠️ **The write path only accepts a slug from `CALC_TOOLS`** (`asCalcTool`),
 * for the same reason `server/go-redirect.ts` hands the click counter the
 * registry's own slug: the tool name arrives from the browser, so an
 * unvalidated one would let anyone mint counter fields. The read path is
 * deliberately permissive so a slug retired from `CALC_TOOLS` keeps reporting
 * its history.
 */

import { parseCalculatorInput } from "./calculator";
import { tehranDay, tehranDayWindow } from "./tehran-day";

export const CALC_EVENTS = ["calc_start", "calc_complete"] as const;

export type CalcEvent = (typeof CALC_EVENTS)[number];

export const CALC_TOOL_JEWELRY = "jewelry";

export const CALC_TOOL_SELLBACK = "sellback";

export const CALC_TOOL_WIZARD = "wizard";

export const CALC_TOOL_MAZANE = "mazane";

export const CALC_TOOLS = [
  CALC_TOOL_JEWELRY,
  CALC_TOOL_SELLBACK,
  CALC_TOOL_WIZARD,
  CALC_TOOL_MAZANE,
] as const;

export type CalcTool = (typeof CALC_TOOLS)[number];

export const CALC_TOOL_NAMES_FA: Readonly<Record<string, string>> = {
  [CALC_TOOL_JEWELRY]: "ماشین‌حساب طلای زینتی",
  [CALC_TOOL_SELLBACK]: "ماشین‌حساب فروش طلای دست‌دوم",
  [CALC_TOOL_WIZARD]: "ویزارد انتخاب سکو",
  [CALC_TOOL_MAZANE]: "مبدل مظنه و نرخ گرم",
};

/**
 * ⚠️ A `calc_complete` for a tool whose required inputs are still empty is a
 * lie about the north-star metric. `weight` and `wage` are what turn the
 * answer into the price of a *piece of jewelry* rather than the price of a
 * gram of gold; `profit` and `vat` stay optional because VAT is pre-filled
 * from statute and many invoices fold the profit into the wage.
 *
 * ⚠️ For the sell-back tool the pair is `weight` and `deduction`: with the
 * deduction left empty the page shows the ceiling — the raw gold value — which
 * is not the answer the visitor came for. `purity` is excluded because it
 * arrives pre-filled at 18k and a visitor who never touches it has still
 * answered the question.
 *
 * ⚠️ Every key here is checked with `parseCalculatorInput`, so only a **numeric**
 * input may be listed. The wizard's other two answers are the words «بله»/«نه»
 * and are deliberately absent: `buildWizardResult` refuses to return a
 * recommendation until both are given, so `hasResult` already carries them.
 *
 * ⚠️ The مظنه converter has exactly one number to give — `amount`. Its
 * direction switch is not listed because it arrives pre-selected and a visitor
 * who never touches it has still asked the question the page exists for.
 */
export const CALC_REQUIRED_INPUTS: Readonly<Record<CalcTool, readonly string[]>> = {
  [CALC_TOOL_JEWELRY]: ["weight", "wage"],
  [CALC_TOOL_SELLBACK]: ["weight", "deduction"],
  [CALC_TOOL_WIZARD]: ["amount"],
  [CALC_TOOL_MAZANE]: ["amount"],
};

/**
 * ⚠️ Without this quiet window a `calc_complete` records the first keystroke
 * that happens to parse — a visitor typing `12` would be counted at `1`, and
 * because the event is once-per-session the real number never replaces it.
 */
export const CALC_COMPLETE_QUIET_MS = 1200;

export const CALC_EVENT_WINDOW_DAYS = 14;

export type CalcEventsByDay = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface CalcEventSource {
  increment(field: string, day: string): Promise<void>;
  read(days: readonly string[]): Promise<CalcEventsByDay>;
}

export type CalcEventSourceFactory = () => CalcEventSource;

export interface CalcEventRow {
  tool: string;
  starts: number[];
  completes: number[];
  startsToday: number;
  completesToday: number;
  startsTotal: number;
  completesTotal: number;
}

export interface CalcEventReport {
  days: string[];
  rows: CalcEventRow[];
  startsTotal: number;
  completesTotal: number;
  available: boolean;
}

export interface CalcEventBody {
  tool: CalcTool;
  event: CalcEvent;
}

let activeSource: CalcEventSource | null = null;
let defaultFactory: CalcEventSourceFactory | null = null;

export function setCalcEventSource(source: CalcEventSource): void {
  activeSource = source;
}

export function setDefaultCalcEventSource(factory: CalcEventSourceFactory): void {
  defaultFactory = factory;
}

export function resetCalcEventSource(): void {
  activeSource = null;
}

function source(): CalcEventSource | null {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) return null;
  activeSource = defaultFactory();
  return activeSource;
}

export function asCalcTool(value: unknown): CalcTool | null {
  if (typeof value !== "string") return null;
  return (CALC_TOOLS as readonly string[]).includes(value) ? (value as CalcTool) : null;
}

export function asCalcEvent(value: unknown): CalcEvent | null {
  if (typeof value !== "string") return null;
  return (CALC_EVENTS as readonly string[]).includes(value) ? (value as CalcEvent) : null;
}

export function calcEventField(tool: string, event: CalcEvent): string {
  return `${tool}:${event}`;
}

export function parseCalcEventField(field: string): { tool: string; event: CalcEvent } | null {
  const separator = field.lastIndexOf(":");
  if (separator <= 0) return null;
  const event = asCalcEvent(field.slice(separator + 1));
  if (event === null) return null;
  return { tool: field.slice(0, separator), event };
}

export function calcEventBody(tool: CalcTool, event: CalcEvent): CalcEventBody {
  return { tool, event };
}

export function calcEventSessionKey(tool: CalcTool, event: CalcEvent): string {
  return `tablo:calc:${tool}:${event}`;
}

export function isCalcStarted(
  initial: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(values)]);
  for (const key of keys) {
    if ((values[key] ?? "") !== (initial[key] ?? "")) return true;
  }
  return false;
}

export function isCalcCompleted(
  tool: CalcTool,
  values: Readonly<Record<string, string>>,
  hasResult: boolean,
): boolean {
  if (!hasResult) return false;
  return CALC_REQUIRED_INPUTS[tool].every(
    (key) => parseCalculatorInput(values[key] ?? "") !== null,
  );
}

export function calcEventDay(nowMs: number): string {
  return tehranDay(nowMs);
}

export function calcEventDays(
  nowMs: number,
  windowDays: number = CALC_EVENT_WINDOW_DAYS,
): string[] {
  return tehranDayWindow(nowMs, windowDays);
}

export async function recordCalcEvent(
  tool: CalcTool,
  event: CalcEvent,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const counter = source();
  if (counter === null) return false;
  try {
    await counter.increment(calcEventField(tool, event), calcEventDay(nowMs));
    return true;
  } catch (error) {
    console.error("calc event counter unavailable; event not recorded", error);
    return false;
  }
}

function totalOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function buildCalcEventReport(
  days: string[],
  byDay: CalcEventsByDay,
  available: boolean,
): CalcEventReport {
  const tools = new Set<string>();
  for (const day of days) {
    for (const field of Object.keys(byDay[day] ?? {})) {
      const parsed = parseCalcEventField(field);
      if (parsed !== null) tools.add(parsed.tool);
    }
  }

  const rows: CalcEventRow[] = [...tools].map((tool) => {
    const starts = days.map((day) => byDay[day]?.[calcEventField(tool, "calc_start")] ?? 0);
    const completes = days.map((day) => byDay[day]?.[calcEventField(tool, "calc_complete")] ?? 0);
    return {
      tool,
      starts,
      completes,
      startsToday: starts[starts.length - 1] ?? 0,
      completesToday: completes[completes.length - 1] ?? 0,
      startsTotal: totalOf(starts),
      completesTotal: totalOf(completes),
    };
  });

  rows.sort((a, b) => {
    const diff = b.completesTotal - a.completesTotal;
    if (diff !== 0) return diff;
    const byStarts = b.startsTotal - a.startsTotal;
    return byStarts !== 0 ? byStarts : a.tool.localeCompare(b.tool);
  });

  return {
    days,
    rows,
    startsTotal: totalOf(rows.map((row) => row.startsTotal)),
    completesTotal: totalOf(rows.map((row) => row.completesTotal)),
    available,
  };
}

export async function getCalcEventReport(
  nowMs: number = Date.now(),
  windowDays: number = CALC_EVENT_WINDOW_DAYS,
): Promise<CalcEventReport> {
  const days = calcEventDays(nowMs, windowDays);
  const counter = source();
  if (counter === null) return buildCalcEventReport(days, {}, false);
  try {
    return buildCalcEventReport(days, await counter.read(days), true);
  } catch (error) {
    console.error("calc event counter unavailable; reporting no data", error);
    return buildCalcEventReport(days, {}, false);
  }
}

export function calcCompletionRate(row: CalcEventRow): number | null {
  if (row.startsTotal <= 0) return null;
  return row.completesTotal / row.startsTotal;
}
