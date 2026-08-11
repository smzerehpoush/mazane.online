/**
 * مرز وب — ‎GET /api/prices‎: استور seed شده ⟸ payload JSON.
 *
 * این نقطه فقط برای مصرف به‌روزرسان کلاینت است: بدون کش (no-store)، همان
 * فهرست سکوها و همان اعداد نمایشیِ رندر سرور (هیچ فرمولی)، و قطع منبع ⟸
 * ردیف با قیمت تهی — نه خطا.
 *
 * تست به `lib/server/live-prices.ts` می‌زند، نه به فایل مسیر: مسیر
 * ‎src/routes/api/prices.ts‎ عمداً پوسته‌ی نازکی است که همین تابع را صدا
 * می‌زند، و بالا آوردن روتر تنکستک برای سنجیدن یک payload بی‌مورد است.
 */
import { describe, expect, it } from "vitest";

import { formatToman } from "../src/lib/format";
import type { LivePricesPayload } from "../src/lib/live-update";
import { livePricesResponse } from "../src/lib/server/live-prices";
import { healthyStore, seed, staleIso, storeWithUnknownFee } from "./support/seed";

async function getPayload(): Promise<{ response: Response; payload: LivePricesPayload }> {
  const response = await livePricesResponse();
  return { response, payload: (await response.json()) as LivePricesPayload };
}

describe("GET /api/prices", () => {
  it("۲۰۰ با Cache-Control: no-store پاسخ می‌دهد (فقط مصرف کلاینت)", async () => {
    seed(healthyStore());
    const { response } = await getPayload();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("دقیقاً همان سکوهای فهرست‌شده — گلدیکای در استور هرگز نمی‌آید", async () => {
    const store = healthyStore();
    seed(store);
    // پیش‌شرط: اسنپ‌شات گلدیکا واقعاً در استور هست ولی در فهرست نیست.
    expect(store.snapshots["goldika"]).not.toBeNull();
    const { payload } = await getPayload();
    expect(payload.rows.map((row) => row.platform_slug)).toEqual([
      "wallgold",
      "talasea",
      "milli",
    ]);
  });

  it("عدد هر سکو همان «قیمت» صفحه است — هم عدد و هم رشته‌ی نمایش fa-IR", async () => {
    const store = healthyStore();
    seed(store);
    const { payload } = await getPayload();
    const wallgold = payload.rows.find((row) => row.platform_slug === "wallgold");
    expect(wallgold).toMatchObject({
      price_toman: 18611000,
      price_display: formatToman(18611000), // «۱۸٬۶۱۱٬۰۰۰»
      updated_at: store.updatedAt["wallgold"],
    });
    expect(wallgold?.price_display).toBe("۱۸٬۶۱۱٬۰۰۰");
  });

  it("سکوی «کارمزد نامشخص» قیمت میانی می‌دهد — همان عددی که صفحه نشان می‌دهد", async () => {
    seed(storeWithUnknownFee());
    const { payload } = await getPayload();
    const digikala = payload.rows.find((row) => row.platform_slug === "digikala");
    expect(digikala).toMatchObject({
      price_toman: 18520000,
      price_display: formatToman(18520000),
    });
  });

  it("قطع منبع ⟸ قیمت تهی و updated_at قدیمی، نه خطا (قاعده‌ی ۵)", async () => {
    const store = healthyStore();
    const stale = staleIso();
    store.snapshots["talasea"] = null; // TTL قیمت جاری گذشته
    store.updatedAt["talasea"] = stale; // ولی updated_at بدون TTL مانده
    seed(store);
    const { response, payload } = await getPayload();
    expect(response.status).toBe(200);
    const talasea = payload.rows.find((row) => row.platform_slug === "talasea");
    expect(talasea).toEqual({
      platform_slug: "talasea",
      price_toman: null,
      price_display: null,
      updated_at: stale,
    });
  });

  it("generated_at زمان معتبر تولید payload است", async () => {
    seed(healthyStore());
    const before = Date.now();
    const { payload } = await getPayload();
    const generated = Date.parse(payload.generated_at);
    expect(Number.isNaN(generated)).toBe(false);
    expect(generated).toBeGreaterThanOrEqual(before - 1000);
    expect(generated).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
