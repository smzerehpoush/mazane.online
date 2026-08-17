/**
 * ⚠️ Fixed +03:30, not `Intl`: Iran abolished DST in 2022, so the Tehran
 * offset is a constant and a day bucket can be derived arithmetically —
 * which keeps the bucket independent of the runtime's ICU version.
 */
const TEHRAN_OFFSET_MS = 12_600_000;

const DAY_MS = 86_400_000;

export function tehranDay(nowMs: number): string {
  return new Date(nowMs + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

export function tehranDayWindow(nowMs: number, windowDays: number): string[] {
  const days: string[] = [];
  for (let back = windowDays - 1; back >= 0; back -= 1) {
    days.push(tehranDay(nowMs - back * DAY_MS));
  }
  return days;
}
