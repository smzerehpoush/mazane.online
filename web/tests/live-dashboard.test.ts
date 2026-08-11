/**
 * هم‌فازی پولینگ با چرخه‌ی گردآورنده (بند ۱۳ و ۱۴ سند طراحی).
 *
 * چرا این تست وجود دارد: فاز فتیله به `updatedAt` **سرور** قفل است، ولی
 * زمان‌بندی فچ قبلاً از لحظه‌ی mount شروع می‌شد. این دو ساعتِ مستقل هرگز روی
 * هم نمی‌افتادند و فتیله هر دور چند ثانیه زودتر (یا دیرتر) از رسیدن داده تمام
 * می‌شد — خرابی‌ای که در مرور چشمی دیده نمی‌شود چون هر دو تکه به‌تنهایی درست
 * کار می‌کنند. بند ۱۳ صریح است: «فتیله دقیقاً هم‌زمان با دریافت داده‌ی جدید
 * تمام می‌شود».
 *
 * `nowMs` ورودی صریح است تا تست به ساعت دیوار وابسته نباشد.
 */
import { describe, expect, it } from "vitest";

import { firstDelayMs, POLL_INTERVAL_MS } from "../src/lib/use-live-dashboard";

/** یک زمان مبنای ثابت — هر عددی که ISO معتبر بدهد. */
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

  it("هرگز صفر یا منفی نمی‌دهد — فچ «موقع mount» ممنوع است (بند ۱۴)", () => {
    // درست پیش از مرز، باقی‌مانده ۱ms است؛ کف یک ثانیه‌ای جلویش را می‌گیرد.
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
    // داده‌ای که «در آینده» مهر خورده: ساعت مرورگر عقب است.
    expect(firstDelayMs(iso(10_000), BASE)).toBe(POLL_INTERVAL_MS);
  });
});
