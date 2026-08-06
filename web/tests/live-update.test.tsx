/**
 * بلیت ۸ — سه چیز در مرز وب:
 *
 * ۱) منطق سوآپ به‌روزرسان زنده به‌صورت تابع خالص: «مقادیر فعلی DOM +
 *    ردیف payload ⟸ مقادیر جدید» — بدون DOM و بدون شبکه.
 * ۲) HTML سروررندر همان قلاب‌های ‎data-live‎ ای را دارد که سوآپ لازم دارد
 *    (قیمت، برچسب زمان، پسوند کهنگی) — و فقط همان‌ها؛ دلتا قلاب ندارد چون
 *    عمداً تا رندر بعدی ISR ثابت می‌ماند.
 * ۳) پیکربندی رندر صفحه: ISR شصت‌ثانیه‌ای، نه force-dynamic (بند ۶.۲).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import Home, * as homePage from "../app/page";
import {
  nextRowDomState,
  STALE_SUFFIX_FA,
  type LiveRowDomState,
} from "../lib/live-update";
import { healthyStore, rowOf, seed, storeWithUnknownFee } from "./support/seed";

const NOW = Date.parse("2026-08-06T12:00:00Z");

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function domState(overrides: Partial<LiveRowDomState> = {}): LiveRowDomState {
  return {
    priceText: "۱۸٬۷۰۴٬۰۵۵",
    updatedAtIso: isoSecondsAgo(90),
    updatedText: "۱ دقیقه پیش",
    staleText: "",
    ...overrides,
  };
}

describe("پیکربندی رندر صفحه‌ی اصلی — ISR شصت‌ثانیه‌ای (بند ۶.۲)", () => {
  it("revalidate=60 و دیگر force-dynamic نیست", () => {
    expect(homePage.revalidate).toBe(60);
    expect("dynamic" in homePage).toBe(false);
  });
});

describe("منطق سوآپ — تابع خالص nextRowDomState", () => {
  it("payload تازه ⟸ قیمت و برچسب زمان هر دو عوض می‌شوند", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: isoSecondsAgo(5),
      },
      NOW,
    );
    expect(next).toEqual({
      priceText: "۱۸٬۷۲۰٬۰۰۰",
      updatedAtIso: isoSecondsAgo(5),
      updatedText: "لحظاتی پیش",
      staleText: "",
    });
  });

  it("payload کهنه ⟸ پسوند کهنگی اضافه می‌شود", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: isoSecondsAgo(10 * 60),
      },
      NOW,
    );
    expect(next.updatedText).toBe("۱۰ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA);
  });

  it("بدون ردیف payload، عدد می‌ماند ولی برچسب زمان از ISO خود DOM پیر می‌شود", () => {
    // سرور «۱ دقیقه پیش» رندر کرده بود؛ ۴ دقیقه گذشته و payload این سکو را ندارد.
    const current = domState({ updatedAtIso: isoSecondsAgo(4 * 60) });
    const next = nextRowDomState(current, undefined, NOW);
    expect(next.priceText).toBe(current.priceText);
    expect(next.updatedAtIso).toBe(current.updatedAtIso);
    expect(next.updatedText).toBe("۴ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA); // آستانه‌ی کهنگی ۳ دقیقه است
  });

  it("قطع منبع (payload بی‌قیمت) ⟸ عدد قبلی می‌ماند و فقط کهنگی گزارش می‌شود", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: null,
        price_display: null,
        updated_at: isoSecondsAgo(10 * 60),
      },
      NOW,
    );
    expect(next.priceText).toBe("۱۸٬۷۰۴٬۰۵۵"); // کهنگی، نه خطا — عدد جعل/پاک نمی‌شود
    expect(next.updatedText).toBe("۱۰ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA);
  });

  it("payload با قیمت ولی بدون updated_at ⟸ قیمت عوض، زمان از ISO خود DOM", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: null,
      },
      NOW,
    );
    expect(next.priceText).toBe("۱۸٬۷۲۰٬۰۰۰");
    expect(next.updatedAtIso).toBe(domState().updatedAtIso);
    expect(next.updatedText).toBe("۱ دقیقه پیش");
  });

  it("بدون هیچ ISO (سکوی بی‌سابقه) هیچ چیز عوض نمی‌شود", () => {
    const current = domState({
      updatedAtIso: null,
      updatedText: "",
      staleText: "",
    });
    const next = nextRowDomState(current, undefined, NOW);
    expect(next).toEqual(current);
  });
});

describe("قلاب‌های data-live در HTML سروررندر", () => {
  it("سلول قیمت هر ردیف معلوم قلاب price و زمانش قلاب updated-at و stale دارد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    for (const [slug, buy] of [
      ["wallgold", "۱۸٬۷۰۴٬۰۵۵"],
      ["talasea", "۱۸٬۷۱۵٬۳۰۰"],
      ["milli", "۱۸٬۶۳۰٬۶۹۰"],
    ] as const) {
      const row = rowOf(html, slug);
      expect(row).toMatch(
        new RegExp(`<span[^>]*data-live="price"[^>]*>${buy}</span>`),
      );
      expect(row).toMatch(/<time[^>]*data-live="updated-at"/);
      expect(row).toMatch(/<strong[^>]*data-live="stale"/);
    }
  });

  it("ردیف «کارمزد نامشخص» هم قلاب price دارد (قیمت میانی‌اش زنده می‌شود)", async () => {
    seed(storeWithUnknownFee());
    const html = renderToStaticMarkup(await Home());
    expect(rowOf(html, "digikala")).toMatch(
      /<span[^>]*data-live="price"[^>]*>۱۸٬۵۲۰٬۰۰۰<\/span>/,
    );
  });

  it("دلتا و جزئیات قلاب زنده ندارند — عمداً فقط با رندر ISR تازه می‌شوند", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    // هر ردیف معلوم دقیقاً یک قلاب قیمت دارد: ۳ سکو ⟸ ۳ قلاب، نه بیشتر.
    expect(html.match(/data-live="price"/g)).toHaveLength(3);
    // بعد از سلول قیمت (سلول دلتا و باقی ردیف) هیچ قلاب قیمتی نیست.
    const milli = rowOf(html, "milli");
    expect(milli).toContain("ارزان‌ترین");
    const afterPriceCell = milli.slice(milli.indexOf("</span>"));
    expect(afterPriceCell).not.toContain('data-live="price"');
  });
});
