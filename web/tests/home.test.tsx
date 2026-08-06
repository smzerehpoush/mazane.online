/**
 * مرز وب: استور seed شده ⟸ HTML رندرشده‌ی صفحه‌ی اصلی.
 *
 * منبع داده با `setPriceSource` تزریق می‌شود؛ هیچ ردیس/شبکه‌ای در کار نیست.
 * اعداد seed همان شکل JSON کانونی گردآورنده‌اند (pydantic model_dump_json).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import RootLayout from "../app/layout";
import Home from "../app/page";
import {
  setPriceSource,
  type PlatformSnapshot,
  type Quote,
  type Side,
} from "../lib/prices";

const FETCHED_AT_ISO = "2026-08-06T09:30:00+00:00";

function quote(side: Side, priceToman: number): Quote {
  return {
    platform_slug: "wallgold",
    instrument: "GOLD_18K",
    side,
    price_toman: priceToman,
    raw_value: "18611000",
    raw_scale: "1",
    fetched_at: "2026-08-06T09:30:00Z",
  };
}

const snapshot: PlatformSnapshot = {
  platform_slug: "wallgold",
  quotes: [quote("MID", 18611000), quote("BUY", 18704055), quote("SELL", 18517945)],
  terms: {
    platform_slug: "wallgold",
    buy_fee_percent: "0.500",
    sell_fee_percent: "0.500",
    round_trip_percent: "0.9950",
    fee_source: "API",
    buy_enabled: true,
    sell_enabled: true,
    observed_at: "2026-08-06T09:30:00Z",
  },
  fetched_at: "2026-08-06T09:30:00Z",
};

function seed(snap: PlatformSnapshot | null, updatedAt: string | null): void {
  setPriceSource({
    getSnapshot: async () => snap,
    getUpdatedAt: async () => updatedAt,
  });
}

/**
 * نام صفت در HTML حساس به حروف نیست (React 19 آن را dateTime می‌نویسد و
 * مرورگر/خزنده datetime می‌خواند)؛ پس تطبیق بدون حساسیت به حروف درست است.
 */
function timeTagPattern(iso: string): RegExp {
  const escaped = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<time [^>]*datetime="${escaped}"`, "i");
}

describe("صفحه‌ی اصلی", () => {
  it("قیمت مؤثر خرید و فروش وال‌گلد را با ارقام فارسی نشان می‌دهد", async () => {
    seed(snapshot, FETCHED_AT_ISO);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("۱۸٬۷۰۴٬۰۵۵"); // مؤثر خرید: 18611000 × 1.005
    expect(html).toContain("۱۸٬۵۱۷٬۹۴۵"); // مؤثر فروش: 18611000 × 0.995
  });

  it("برچسب «آخرین به‌روزرسانی» را با <time datetime> در خود HTML می‌گذارد", async () => {
    seed(snapshot, FETCHED_AT_ISO);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("آخرین به‌روزرسانی");
    expect(html).toMatch(timeTagPattern(FETCHED_AT_ISO));
  });

  it("بدون قیمت جاری هم رندر می‌شود و برچسب زمان را نگه می‌دارد (کهنگی، نه خطا)", async () => {
    seed(null, FETCHED_AT_ISO);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("آخرین به‌روزرسانی");
    expect(html).toMatch(timeTagPattern(FETCHED_AT_ISO));
  });
});

describe("لایه‌ی ریشه", () => {
  it("فارسی و راست‌به‌چپ است", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main />
      </RootLayout>,
    );
    expect(html).toContain('<html lang="fa" dir="rtl"');
  });
});
