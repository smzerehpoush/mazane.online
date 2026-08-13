import { describe, expect, it } from "vitest";

import { firstDelayMs, POLL_INTERVAL_MS } from "../src/lib/use-live-dashboard";

const BASE = Date.parse("2026-08-11T12:00:00.000Z");
const iso = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString();

describe("firstDelayMs — اولین فچ روی چرخه‌ی گردآورنده می‌نشیند", () => {
  it("۵ ثانیه پس از داده ⟸ ۲۵ ثانیه صبر، نه ۳۰", () => {
    expect(firstDelayMs(iso(0), BASE + 5_000)).toBe(25_000);
  });

  it("۲۰ ثانیه پس از داده ⟸ ۱۰ ثانیه صبر", () => {
    expect(firstDelayMs(iso(0), BASE + 20_000)).toBe(10_000);
  });

  it("چرخه‌های گذشته را می‌پیچاند: ۶۵ ثانیه ⟸ ۲۵ ثانیه", () => {
    expect(firstDelayMs(iso(0), BASE + 65_000)).toBe(25_000);
  });

  it("دقیقاً روی مرز ⟸ یک بازه‌ی کامل، نه صفر", () => {
    expect(firstDelayMs(iso(0), BASE + POLL_INTERVAL_MS)).toBe(POLL_INTERVAL_MS);
  });

  it("هرگز صفر یا منفی نمی‌دهد — فچ «موقع mount» ممنوع است", () => {
    expect(firstDelayMs(iso(0), BASE + POLL_INTERVAL_MS - 1)).toBe(1_000);
    for (let elapsed = 0; elapsed < POLL_INTERVAL_MS; elapsed += 137) {
      expect(firstDelayMs(iso(0), BASE + elapsed)).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("هرگز از یک بازه‌ی کامل بیشتر نمی‌شود", () => {
    for (let elapsed = 0; elapsed < 3 * POLL_INTERVAL_MS; elapsed += 311) {
      expect(firstDelayMs(iso(0), BASE + elapsed)).toBeLessThanOrEqual(POLL_INTERVAL_MS);
    }
  });

  it("بدون زمان سرور ⟸ رفتار قبلی (یک بازه‌ی کامل)", () => {
    expect(firstDelayMs(null, BASE)).toBe(POLL_INTERVAL_MS);
  });

  it("زمان نامعتبر ⟸ یک بازه‌ی کامل، نه NaN", () => {
    expect(firstDelayMs("نه‌یک‌تاریخ", BASE)).toBe(POLL_INTERVAL_MS);
  });

  it("ساعتِ عقب‌مانده‌ی کاربر ⟸ یک بازه‌ی کامل، نه فچ زودهنگام", () => {
    expect(firstDelayMs(iso(10_000), BASE)).toBe(POLL_INTERVAL_MS);
  });
});
