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

describe("قلاب‌های داشبورد در HTML سروررندر", () => {
  /**
   * ⚠️ با بازطراحی، جدول (و قلاب‌های ‎data-live‎ اش) حذف شد. سوآپ زنده حالا
   * روی نشانگرهای محور و کارت‌های منبع کار می‌کند. قرارداد همان است — «کلاینت
   * فقط متن و موقعیتِ از قبل حساب‌شده را می‌نشاند» — فقط سلکتورها عوض شده‌اند.
   */
  it("هر منبع نشانگر نشان‌دار با گره‌ی قیمت دارد", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    for (const [slug, price] of [
      ["wallgold", "۱۸٬۶۱۱٬۰۰۰"],
      ["talasea", "۱۸٬۵۳۰٬۰۰۰"],
      ["milli", "۱۸٬۵۳۸٬۰۰۰"],
    ] as const) {
      expect(html, slug).toContain(`data-rail-marker="${slug}"`);
      const marker = html.match(new RegExp(`<a[^>]*data-rail-marker="${slug}"[\\s\\S]*?</a>`));
      expect(marker?.[0], slug).toMatch(new RegExp(`data-rail-price[^>]*>${price}</span>`));
    }
  });

  it("هر منبع کارت نشان‌دار با گره‌ی قیمت دارد", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    for (const slug of ["wallgold", "talasea", "milli"]) {
      expect(html, slug).toContain(`data-source-card="${slug}"`);
    }
    expect(html).toContain("data-source-price");
  });

  it("پاورقی محور قلاب‌های به‌روزرسانی دارد", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    expect(html).toContain("data-rail-max");
    expect(html).toContain("data-rail-min");
    expect(html).toContain("data-rail-spread");
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

describe("هم‌ارزی payload با رندر سرور", () => {
  /**
   * ⚠️ قلب قرارداد زنده: رشته‌ای که polling می‌نشاند باید **بیت‌به‌بیت** همان
   * چیزی باشد که رندر سرور گذاشته، وگرنه عدد در اولین تیک بی‌دلیل «تغییر»
   * می‌کند. هر دو از یک تابع می‌آیند (`lib/dashboard.ts`) و این تست همان را
   * قفل می‌کند.
   */
  it("price_display هر سکو همان رشته‌ی رندرشده روی نشانگر است", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    const payload = await livePricesPayload();
    expect(payload.dashboard?.sources).not.toHaveLength(0);
    for (const source of payload.dashboard?.sources ?? []) {
      if (source.price_display === null) continue;
      const marker = html.match(
        new RegExp(`<a[^>]*data-rail-marker="${source.slug}"[\\s\\S]*?</a>`),
      );
      if (marker === null) continue;
      expect(marker[0], source.slug).toContain(source.price_display);
    }
  });

  /**
   * هندسه هم باید از همان تابع بیاید. اگر `/api/prices` نسخه‌ی دوم محاسبه
   * داشت، نشانگرها بعد از اولین polling به موقعیتی می‌پریدند که با رندر
   * اولیه نمی‌خواند — خرابی‌ای که فقط در مرورگر و بعد از ۳۰ ثانیه دیده می‌شود.
   */
  it("rail_percent payload همان درصدی است که سرور رندر کرده", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    const payload = await livePricesPayload();
    for (const source of payload.dashboard?.sources ?? []) {
      if (source.rail_percent === null) continue;
      const marker = html.match(new RegExp(`<a[^>]*data-rail-marker="${source.slug}"[^>]*>`));
      if (marker === null) continue;
      expect(marker[0], source.slug).toContain(`right:${source.rail_percent}%`);
    }
  });
});
