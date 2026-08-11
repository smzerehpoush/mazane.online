/**
 * ماشین‌حساب دوحالته‌ی صفحه‌ی سکو (بلیت ۳۵).
 *
 * دو لایه‌ی جدا:
 *  ۱. تابع خالص `lib/calculator.ts` — پارس ورودی فارسی/لاتین و تبدیل
 *     وزن⟸مبلغ، بدون هیچ React/DOM.
 *  ۲. رندر SSR `PlatformCalculator` — چون محیط تست `node` است (بدون jsdom)،
 *     رفتار «تایپ کن، آن‌یکی زنده حساب شود» را همان تابع خالص بالا می‌سنجد؛
 *     اینجا فقط علامت‌گذاری اولیه‌ی DOM (زبانه‌ها، ورودی‌ها، برچسب‌ها، دکمه‌ی
 *     شروع معامله) را می‌سنجیم — دقیقاً همان مرزی که بقیه‌ی تست‌های وب این
 *     مخزن دارند (`renderToStaticMarkup`).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformCalculator } from "../src/components/content/PlatformCalculator";
import { amountFromWeight, parseCalculatorInput, weightFromAmount } from "../src/lib/calculator";
import type { ListedPlatform } from "../src/lib/prices";
import type { Row } from "../src/lib/rows";
import { SlugPageView } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { freshIso, makeSnapshot, seed, slugPageData, type SeededStore } from "./support/seed";

/* ------------------------------------------------------------------------ */
/* لایه‌ی ۱ — تابع خالص                                                     */
/* ------------------------------------------------------------------------ */

describe("parseCalculatorInput — ورودی رشته‌ای کاربر ⟸ عدد یا null", () => {
  it("رقم لاتین ساده را می‌پذیرد", () => {
    expect(parseCalculatorInput("1.5")).toBe(1.5);
    expect(parseCalculatorInput("18704055")).toBe(18704055);
  });

  it("رقم فارسی و جداکننده‌ی اعشار فارسی را می‌پذیرد", () => {
    expect(parseCalculatorInput("۱٫۵")).toBe(1.5);
    expect(parseCalculatorInput("۱۸۷۰۴۰۵۵")).toBe(18704055);
  });

  it("جداکننده‌ی هزارگان فارسی و لاتین را نادیده می‌گیرد", () => {
    expect(parseCalculatorInput("۱۸٬۷۰۴٬۰۵۵")).toBe(18704055);
    expect(parseCalculatorInput("18,704,055")).toBe(18704055);
  });

  it("خالی/فقط‌فاصله ⟸ null، نه صفر", () => {
    expect(parseCalculatorInput("")).toBeNull();
    expect(parseCalculatorInput("   ")).toBeNull();
  });

  it("نامعتبر (حرف، چند نقطه، منفی) ⟸ null، نه NaN", () => {
    expect(parseCalculatorInput("abc")).toBeNull();
    expect(parseCalculatorInput("۱.۲.۳")).toBeNull();
    expect(parseCalculatorInput("-5")).toBeNull();
    expect(Number.isNaN(parseCalculatorInput("abc"))).toBe(false);
  });

  it("صفر ⟸ null (وزن/مبلغ صفر چیزی برای نمایش نیست)", () => {
    expect(parseCalculatorInput("0")).toBeNull();
    expect(parseCalculatorInput("۰")).toBeNull();
  });
});

describe("amountFromWeight / weightFromAmount — تبدیل دوسویه روی یک قیمت واحد", () => {
  it("وزن ⟸ مبلغ، گرد به نزدیک‌ترین تومان", () => {
    expect(amountFromWeight(1, 18704055)).toBe(18704055);
    expect(amountFromWeight(0.5, 18704055)).toBe(9352028); // 9352027.5 گرد به بالا
  });

  it("مبلغ ⟸ وزن، تا چهار رقم اعشار", () => {
    expect(weightFromAmount(18704055, 18704055)).toBe(1);
    expect(weightFromAmount(9352027.5, 18704055)).toBeCloseTo(0.5, 4);
  });

  it("رفت‌وبرگشت هم‌ارز است: وزن ⟸ مبلغ ⟸ همان وزن", () => {
    const weight = 2.25;
    const unitPrice = 18530000;
    const amount = amountFromWeight(weight, unitPrice);
    expect(weightFromAmount(amount, unitPrice)).toBeCloseTo(weight, 3);
  });

  it("قیمت واحدِ نامعتبر (صفر/منفی) ⟸ null، نه Infinity/NaN", () => {
    expect(weightFromAmount(1000, 0)).toBeNull();
    expect(weightFromAmount(1000, -5)).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* لایه‌ی ۲ — رندر SSR                                                       */
/* ------------------------------------------------------------------------ */

const PLATFORM: ListedPlatform = {
  slug: "talasea",
  name_fa: "طلاسی",
  data_policy: "ALLOWED",
  website_url: "https://talasea.ir",
};

function knownFeeRow(opts: { sellEnabled?: boolean } = {}): Row {
  return {
    platform: PLATFORM,
    updatedAt: freshIso(),
    snapshot: makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      fetchedAt: freshIso(),
      sellEnabled: opts.sellEnabled ?? true,
    }),
  };
}

function unknownFeeRow(): Row {
  return {
    platform: { ...PLATFORM, slug: "digikala", name_fa: "دیجی‌کالا" },
    updatedAt: freshIso(),
    snapshot: makeSnapshot({
      slug: "digikala",
      mid: 18400000,
      feeSource: "UNKNOWN",
      fetchedAt: freshIso(),
    }),
  };
}

describe("PlatformCalculator — یک حالت برای همه‌ی سکوها", () => {
  it("دو ورودی دوسویه (وزن، مبلغ) روی «قیمت» سکو، بدون زبانه", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain("ماشین‌حساب معامله");
    // زبانه‌ی خرید/فروش با حذف قیمت مؤثر بی‌موضوع شد: یک عدد بیشتر نیست
    // (سند تصمیم ۰۰۰۲).
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
    expect(html).toContain("data-calc-amount");
    // برچسب صریح می‌گوید کارمزد در این عدد نیست.
    expect(html).toContain("بدون احتساب کارمزد");
  });

  it("بستن یک سمت شکل ماشین‌حساب را عوض نمی‌کند — عدد یکی است", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow({ sellEnabled: false })} hasOutbound={true} />,
    );
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
  });

  it("دکمه‌ی «شروع معامله» به /go/<slug> با rel و target کامل می‌رود", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain('href="/go/talasea"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("شروع معامله در طلاسی");
  });

  it("بدون مقصد خروجی، دکمه‌ی مرده نمی‌سازد", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={false} />,
    );
    expect(html).not.toContain("/go/talasea");
    expect(html).not.toContain("شروع معامله");
  });
});

describe("PlatformCalculator — سکوی کارمزد نامعلوم (همان شکل)", () => {
  it("دقیقاً همان شکل سکوی کارمزدمعلوم — دیگر حالت ویژه‌ای نیست", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={unknownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain("ماشین‌حساب معامله");
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
    expect(html).toContain("data-calc-amount");
    expect(html).toContain("بدون احتساب کارمزد");
    // ورودی مبلغ خالی می‌ماند — صفر/NaN جعلی جایش نمی‌نشیند.
    expect(html).toMatch(/data-calc-amount[^>]*value=""/);
  });

  it("دکمه‌ی شروع معامله اینجا هم می‌آید", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={unknownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain('href="/go/digikala"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
  });
});

describe("PlatformCalculator — قطع منبع", () => {
  it("بدون اسنپ‌شات چیزی رندر نمی‌کند (قاعده‌ی ۵)", () => {
    const row: Row = { platform: PLATFORM, snapshot: null, updatedAt: null };
    const html = renderToStaticMarkup(<PlatformCalculator row={row} hasOutbound={true} />);
    expect(html).toBe("");
  });
});

/* ------------------------------------------------------------------------ */
/* مرز وب کامل — مونت‌شده زیر «قیمت امروز» در PlatformPage                  */
/* ------------------------------------------------------------------------ */

describe("PlatformPage — ماشین‌حساب زیر «قیمت امروز» مونت شده", () => {
  function store(): SeededStore {
    const now = freshIso();
    return {
      listed: [
        {
          slug: "talasea",
          name_fa: "طلاسی",
          data_policy: "ALLOWED",
          website_url: "https://talasea.ir",
        },
        {
          slug: "digikala",
          name_fa: "دیجی‌کالا",
          data_policy: "ALLOWED",
          website_url: "https://www.digikala.com",
        },
      ],
      snapshots: {
        talasea: makeSnapshot({
          slug: "talasea",
          mid: 18530000,
          fetchedAt: now,
        }),
        digikala: makeSnapshot({
          slug: "digikala",
          mid: 18400000,
          feeSource: "UNKNOWN",
          fetchedAt: now,
        }),
      },
      updatedAt: { talasea: now, digikala: now },
    };
  }

  async function renderSlug(slug: string): Promise<string> {
    const data = await slugPageData(slug);
    if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
    return renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
  }

  it("سکوی کارمزدمعلوم: ماشین‌حساب بعد از «قیمت امروز» می‌آید", async () => {
    seed(store());
    const html = await renderSlug("talasea");
    const termsIndex = html.indexOf('aria-labelledby="terms-heading"');
    const calcIndex = html.indexOf("data-platform-calculator");
    expect(termsIndex).toBeGreaterThan(-1);
    expect(calcIndex).toBeGreaterThan(termsIndex);
  });

  it("سکوی کارمزد نامعلوم هم «قیمت امروز» می‌گیرد و هم ماشین‌حساب", async () => {
    seed(store());
    const html = await renderSlug("digikala");
    // پیش‌تر این بخش برای چنین سکویی اصلاً رندر نمی‌شد چون قیمت مؤثر نداشت؛
    // حالا قیمتش با بقیه هم‌جنس است (سند تصمیم ۰۰۰۲) و فقط کارمزدش نامشخص.
    expect(html).toContain('aria-labelledby="terms-heading"');
    expect(html).toContain("data-platform-calculator");
    expect(html).toContain("بدون احتساب کارمزد");
  });
});
