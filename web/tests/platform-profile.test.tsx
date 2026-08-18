import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import {
  emptyProfile,
  normalizePlatformProfile,
  validatePlatformProfiles,
  type PlatformProfile,
  type PlatformProfileEntry,
} from "../src/lib/platform-profile";
import { REGISTRY_PLATFORMS } from "../src/lib/registry";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  seed,
  seedHistory,
  seedReferencePrice,
  slugPageData,
  type SeededStore,
} from "./support/seed";

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold"],
  published: false,
  purity: "750",
});

function profile(patch: Partial<PlatformProfile> = {}): PlatformProfile {
  return { ...emptyProfile(), ...patch };
}

function wallgold(patch: Partial<ListedPlatform> = {}): ListedPlatform {
  return {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    name_en: "Wallgold",
    website_url: "https://wallgold.ir",
    ...patch,
  };
}

function storeFor(platform: ListedPlatform): SeededStore {
  const now = freshIso();
  return {
    listed: [platform],
    instruments: [TALA18],
    snapshots: { wallgold: makeSnapshot({ slug: "wallgold", mid: 18611000, fetchedAt: now }) },
    updatedAt: { wallgold: now },
  };
}

async function render(platform: ListedPlatform): Promise<string> {
  seed(storeFor(platform));
  seedHistory([]);
  seedReferencePrice(null);
  const data = await slugPageData("wallgold");
  if (data === null) throw new Error("wallgold returned 404");
  return renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
}

const FULL = profile({
  payment_methods: ["GATEWAY", "CARD_TO_CARD"],
  kyc_level: "BASIC",
  mobile_app: "BOTH",
  delivery_cost_fa: "ارسال شمش با پست پیشتاز و هزینه بر عهده‌ی خریدار",
  min_buy_toman: 100000,
  min_sell_toman: 50000,
  pros_fa: ["کارمزد خرید پایین", "برداشت ریالی سریع"],
  cons_fa: ["تحویل فیزیکی فقط در تهران"],
  faq: [{ question_fa: "برداشت چقدر طول می‌کشد؟", answer_fa: "معمولاً همان روز کاری." }],
});

describe("platform profile — an empty profile stays invisible", () => {
  it("a platform with no profile row renders none of the new sections", async () => {
    const html = await render(wallgold());
    expect(html).not.toContain("شرایط و مشخصات");
    expect(html).not.toContain("نقاط قوت و ضعف");
    expect(html).not.toContain("پرسش‌های پرتکرار");
    expect(html).not.toContain("data-platform-profile");
  });

  it("an all-empty profile object is treated the same as no profile at all", async () => {
    const html = await render(wallgold({ profile: profile() }));
    expect(html).not.toContain("شرایط و مشخصات");
    expect(html).not.toContain("نقاط قوت و ضعف");
  });

  it("the identity section the earlier phase owns is untouched", async () => {
    const html = await render(wallgold());
    expect(html).toContain("هویت و تحویل فیزیکی");
    expect(html).toContain("هنوز نمی‌دانیم این سکو زیر نام کدام شرکت ثبت شده است");
    expect(html).toContain("تحویل فیزیکی این سکو را هنوز بررسی نکرده‌ایم");
  });

  it("the dead minimum-order row is gone from the fee section", async () => {
    const html = await render(wallgold());
    expect(html).not.toContain("حداقل سفارش");
    expect(html).not.toContain("data-min-order");
  });
});

describe("platform profile — a filled profile renders in Persian", () => {
  it("every collected field shows its Persian label and value", async () => {
    const html = await render(wallgold({ profile: FULL, founded_year_jalali: 1399 }));
    expect(html).toContain("شرایط و مشخصات");
    expect(html).toContain("۱۳۹۹");
    expect(html).toContain("اندروید و iOS");
    expect(html).toContain("درگاه بانکی، کارت به کارت");
    expect(html).toContain("شماره موبایل و کد ملی");
    expect(html).toContain("۱۰۰٬۰۰۰ تومان");
    expect(html).toContain("۵۰٬۰۰۰ تومان");
    expect(html).toContain("ارسال شمش با پست پیشتاز");
  });

  it("the founding year is not grouped like a price", async () => {
    const html = await render(wallgold({ founded_year_jalali: 1399 }));
    expect(html).toContain("۱۳۹۹");
    expect(html).not.toContain("۱٬۳۹۹");
  });

  it("pros, cons and the editorial disclaimer render together", async () => {
    const html = await render(wallgold({ profile: FULL }));
    expect(html).toContain("نقاط قوت و ضعف");
    expect(html).toContain("کارمزد خرید پایین");
    expect(html).toContain("تحویل فیزیکی فقط در تهران");
    expect(html).toContain("این جمع‌بندی نظر تحریریه‌ی تابلوست، نه ادعای خود سکو.");
  });

  it("the per-platform FAQ renders question and answer", async () => {
    const html = await render(wallgold({ profile: FULL }));
    expect(html).toContain("پرسش‌های پرتکرار درباره‌ی وال‌گلد");
    expect(html).toContain("برداشت چقدر طول می‌کشد؟");
    expect(html).toContain("معمولاً همان روز کاری.");
  });
});

describe("platform profile — a half-filled section never implies an answer", () => {
  it("filling only the pros makes the empty cons say we have not looked yet", async () => {
    const html = await render(wallgold({ profile: profile({ pros_fa: ["کارمزد پایین"] }) }));
    expect(html).toContain("نقاط ضعف این سکو را هنوز جمع‌بندی نکرده‌ایم");
    expect(html).not.toContain("نقاط قوت این سکو را هنوز جمع‌بندی نکرده‌ایم");
  });

  it("filling only the cons makes the empty pros say we have not looked yet", async () => {
    const html = await render(wallgold({ profile: profile({ cons_fa: ["تحویل کند"] }) }));
    expect(html).toContain("نقاط قوت این سکو را هنوز جمع‌بندی نکرده‌ایم");
  });

  it("a registry-only founding year still opens the section with honest siblings", async () => {
    const html = await render(wallgold({ founded_year_jalali: 1399 }));
    expect(html).toContain("شرایط و مشخصات");
    expect(html).toContain("روش‌های پرداخت این سکو را هنوز بررسی نکرده‌ایم");
    expect(html).toContain("هنوز نمی‌دانیم این سکو برای شروع چه احراز هویتی می‌خواهد");
    expect(html).toContain("حداقل مبلغ خرید این سکو را هنوز بررسی نکرده‌ایم");
    expect(html).toContain("حداقل مبلغ فروش این سکو را هنوز بررسی نکرده‌ایم");
    expect(html).toContain("هزینه‌ی تحویل فیزیکی این سکو را هنوز بررسی نکرده‌ایم");
  });

  it("a DB-only field opens the section and the missing founding year is honest too", async () => {
    const html = await render(wallgold({ profile: profile({ kyc_level: "FULL" }) }));
    expect(html).toContain("سال تأسیس این سکو را هنوز پیدا نکرده‌ایم");
    expect(html).toContain("هنوز بررسی نکرده‌ایم این سکو اپلیکیشن موبایل دارد یا نه");
    expect(html).toContain("احراز هویت کامل با تصویر");
  });

  it("no empty field is ever a placeholder or a bare dash", async () => {
    const html = await render(wallgold({ profile: profile({ kyc_level: "NONE" }) }));
    expect(html).not.toContain(">ثبت نشده است<");
    expect(html).not.toContain(">—<");
    expect(html).not.toContain("undefined");
  });
});

describe("platform profile — the outage path", () => {
  it("the static registry carries no profile, so a Redis outage cannot invent one", async () => {
    for (const platform of REGISTRY_PLATFORMS) {
      expect(platform.profile ?? null).toBeNull();
    }
    const html = await render(wallgold());
    expect(html).toContain("وال‌گلد");
    expect(html).not.toContain("شرایط و مشخصات");
  });

  it("a corrupted enum in the payload renders nothing instead of throwing", async () => {
    const corrupted = { ...emptyProfile(), kyc_level: "NOT_A_LEVEL" } as unknown as PlatformProfile;
    const html = await render(wallgold({ profile: { ...corrupted, min_buy_toman: 100000 } }));
    expect(html).toContain("۱۰۰٬۰۰۰ تومان");
    expect(html).not.toContain("NOT_A_LEVEL");
  });

  it("a non-positive minimum is not rendered as a real minimum", async () => {
    const html = await render(
      wallgold({ profile: profile({ min_buy_toman: 0, kyc_level: "NONE" }) }),
    );
    expect(html).toContain("حداقل مبلغ خرید این سکو را هنوز بررسی نکرده‌ایم");
  });
});

describe("platform profile — normalization and validation", () => {
  const LISTED = new Set(["wallgold"]);

  function entry(patch: Partial<PlatformProfileEntry> = {}): PlatformProfileEntry {
    return { slug: "wallgold", ...emptyProfile(), ...patch };
  }

  it("blank lines and stray whitespace never become list items", () => {
    const normalized = normalizePlatformProfile(
      entry({ pros_fa: ["  کارمزد پایین  ", "   ", ""], cons_fa: [] }),
    );
    expect(normalized.pros_fa).toEqual(["کارمزد پایین"]);
  });

  it("an empty text field is stored as null, not as an empty string", () => {
    expect(
      normalizePlatformProfile(entry({ delivery_cost_fa: "   " })).delivery_cost_fa,
    ).toBeNull();
  });

  it("payment methods are deduplicated and kept in a stable order", () => {
    const normalized = normalizePlatformProfile(
      entry({ payment_methods: ["WALLET", "GATEWAY", "WALLET"] }),
    );
    expect(normalized.payment_methods).toEqual(["GATEWAY", "WALLET"]);
  });

  it("a half-written FAQ pair is dropped rather than published", () => {
    const normalized = normalizePlatformProfile(
      entry({
        faq: [
          { question_fa: "سؤال بی‌جواب", answer_fa: "  " },
          { question_fa: "سؤال درست", answer_fa: "جواب درست" },
        ],
      }),
    );
    expect(normalized.faq).toEqual([{ question_fa: "سؤال درست", answer_fa: "جواب درست" }]);
  });

  it("an unlisted slug is rejected", () => {
    expect(validatePlatformProfiles([entry({ slug: "ghost" })], LISTED)).toContain("ghost");
  });

  it("a zero or fractional minimum is rejected", () => {
    expect(validatePlatformProfiles([entry({ min_buy_toman: 0 })], LISTED)).not.toBeNull();
    expect(validatePlatformProfiles([entry({ min_sell_toman: 1.5 })], LISTED)).not.toBeNull();
  });

  it("an over-long pros item is rejected", () => {
    expect(
      validatePlatformProfiles([entry({ pros_fa: ["ا".repeat(401)] })], LISTED),
    ).not.toBeNull();
  });

  it("a clean entry passes", () => {
    expect(validatePlatformProfiles([entry({ ...FULL })], LISTED)).toBeNull();
  });
});
