/**
 * بلیت ۸ — سه چیز در مرز وب:
 *
 * ۱) منطق سوآپ به‌روزرسان زنده به‌صورت تابع خالص: «مقادیر فعلی DOM +
 *    ردیف payload ⟸ مقادیر جدید» — بدون DOM و بدون شبکه.
 * ۲) HTML سروررندر همان قلاب‌های ‎data-live‎ ای را دارد که سوآپ لازم دارد
 *    (قیمت، برچسب زمان، پسوند کهنگی) — و فقط همان‌ها.
 * ۳) رشته‌ی `price_display` که ‎/api/prices‎ می‌دهد بیت‌به‌بیت همان است که
 *    رندر سرور در سلول قیمت گذاشته — وگرنه سوآپ عدد را «می‌پراند».
 *
 * ⚠️ تست پیکربندی رندر (`revalidate = 60`) حذف شد: ISR مفهومی مالِ نکست بود
 * و در تنکستک استارت وجود ندارد. جایگزینش سیاست کش لبه است که در
 * `tests/seo.test.ts` سنجیده می‌شود (‎s-maxage=60‎ + ‎stale-if-error‎).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import {
  nextRateCardCountdown,
  nextRowDomState,
  RATE_CARD_POLL_SECONDS,
  STALE_SUFFIX_FA,
  type LiveRowDomState,
} from "../src/lib/live-update";
import { livePricesPayload } from "../src/lib/server/live-prices";
import { healthyStore, homeData, rowOf, storeWithUnknownFee } from "./support/seed";

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
  it("سلول قیمت هر ردیف قلاب price و زمانش قلاب updated-at و stale دارد", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    for (const [slug, price] of [
      ["wallgold", "۱۸٬۶۱۱٬۰۰۰"],
      ["talasea", "۱۸٬۵۳۰٬۰۰۰"],
      ["milli", "۱۸٬۵۳۸٬۰۰۰"],
    ] as const) {
      const row = rowOf(html, slug);
      expect(row).toMatch(new RegExp(`<span[^>]*data-live="price"[^>]*>${price}</span>`));
      expect(row).toMatch(/<time[^>]*data-live="updated-at"/);
      expect(row).toMatch(/<strong[^>]*data-live="stale"/);
    }
  });

  it("ردیف «کارمزد نامشخص» هم قلاب price دارد (قیمتش زنده می‌شود)", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(storeWithUnknownFee())} />);
    expect(rowOf(html, "digikala")).toMatch(/<span[^>]*data-live="price"[^>]*>۱۸٬۵۲۰٬۰۰۰<\/span>/);
  });

  it("فقط ستون خرید قلاب زنده دارد — ستون فروش و کارت‌ها عمداً بی‌قلاب‌اند", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    // هر ردیف دقیقاً یک قلاب قیمت دارد: ۳ سکو ⟸ ۳ قلاب، نه بیشتر.
    expect(html.match(/data-live="price"/g)).toHaveLength(3);
    const milli = rowOf(html, "milli");
    const afterPriceCell = milli.slice(milli.indexOf('data-live="price"') + 1);
    expect(afterPriceCell).not.toContain('data-live="price"');
  });
});

describe("شمارنده‌ی زنده‌ی کارت نرخ — تابع خالص nextRateCardCountdown (بلیت ۳۱)", () => {
  it("هر تیک، وقتی داده تازه است، یکی کم می‌شود و دریافتی درخواست نمی‌شود", () => {
    expect(nextRateCardCountdown(30, false)).toEqual({ secondsRemaining: 29, shouldFetch: false });
    expect(nextRateCardCountdown(15, false)).toEqual({ secondsRemaining: 14, shouldFetch: false });
    expect(nextRateCardCountdown(1, false)).toEqual({ secondsRemaining: 0, shouldFetch: false });
  });

  it("در صفر، یک نوبت دریافت واقعی لازم است و شمارنده دوباره از ۳۰ شروع می‌شود", () => {
    expect(nextRateCardCountdown(0, false)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: true,
    });
  });

  it("کهنگی شمارنده را خاموش می‌کند — همیشه به ۳۰ می‌پرد و هرگز دریافت نمی‌خواهد", () => {
    expect(nextRateCardCountdown(12, true)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: false,
    });
    // حتی درست در صفر هم کهنگی اولویت دارد — دریافتی درخواست نمی‌شود.
    expect(nextRateCardCountdown(0, true)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: false,
    });
  });
});

describe("هم‌ارزی رشته‌ی payload با رشته‌ی رندر سرور", () => {
  it("price_display هر سکو بیت‌به‌بیت همان چیزی است که در سلول قیمت رندر شده", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    const payload = await livePricesPayload();
    expect(payload.rows).not.toHaveLength(0);
    for (const row of payload.rows) {
      if (row.price_display === null) continue;
      expect(rowOf(html, row.platform_slug)).toMatch(
        new RegExp(`<span[^>]*data-live="price"[^>]*>${row.price_display}</span>`),
      );
    }
  });
});
