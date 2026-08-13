import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { NotFoundPanel } from "../src/components/content/NotFoundPanel";
import { SlugPageView, slugHead } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import type { PlatformHistory } from "../src/lib/history";
import { formatDateFa, formatDateTimeFa } from "../src/lib/format";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, resolveSlug } from "../src/lib/slugs";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  rowOf,
  seed,
  seedHistory,
  seedHistoryByQuery,
  seedReferencePrice,
  slugPageData,
  staleIso,
  type SeededStore,
} from "./support/seed";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    name_en: "Wallgold",
    website_url: "https://wallgold.ir",
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    name_en: "Talasea",
    website_url: "https://talasea.ir",
    legal_entity: "شرکت توسعه راهکار الوند ارسباران",
    delivery_note_fa: "تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)",
  },
  {
    slug: "daric",
    name_fa: "داریک",
    data_policy: "ALLOWED",
    market_model: "ORDER_BOOK",
    name_en: "Daric",
    website_url: "https://daric.gold",
  },
  {
    slug: "digikala",
    name_fa: "دیجی‌کالا",
    data_policy: "ALLOWED",
    name_en: "Digikala",
    website_url: "https://www.digikala.com",
  },
];

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold", "talasea", "daric", "digikala"],
  published: true,
  purity: "750",
});

const NOGHRE_SINGLE: InstrumentListing = makeListing({
  slug: "noghre",
  instrument: "SILVER_990",
  name_fa: "نقره‌ی ۹۹۰",
  supporting: ["wallgold"],
  published: false,
  purity: "990",
});

function assetStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18, NOGHRE_SINGLE],
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        fetchedAt: now,
      }),
      daric: makeSnapshot({
        slug: "daric",
        mid: 18501633,
        fetchedAt: now,
      }),
      digikala: makeSnapshot({
        slug: "digikala",
        mid: 18400000,
        feeSource: "UNKNOWN",
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, daric: now, digikala: now },
  };
}

async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
  return data;
}

async function renderSlug(slug: string): Promise<string> {
  return renderToStaticMarkup(<SlugPageView data={await pageOf(slug)} />);
}

describe("حل‌کننده‌ی اسلاگ تخت", () => {
  it("کلمات رزرو را رد می‌کند — حتی اگر payload آن اسلاگ را ادعا کند", async () => {
    const store = assetStore();
    store.instruments = [
      ...(store.instruments ?? []),
      makeListing({
        slug: "blog",
        instrument: "XAU",
        name_fa: "انس جهانی طلا",
        supporting: ["wallgold", "talasea"],
        published: true,
      }),
    ];
    seed(store);
    for (const word of ["blog", "go", "api", "sitemap.xml", "robots.txt", "_next", "about"]) {
      expect(isReservedSlug(word)).toBe(true);
      expect(await resolveSlug(word)).toBeNull();
      expect(await slugPageData(word)).toBeNull();
    }
    expect(await slugPageData("darbare-pishnahad")).toBeNull();
  });

  it("اسلاگ دارایی ⟸ دارایی، اسلاگ سکو ⟸ سکو، ناشناخته ⟸ ۴۰۴", async () => {
    seed(assetStore());
    expect((await pageOf("tala-18")).kind).toBe("instrument");
    expect((await pageOf("wallgold")).kind).toBe("platform");
    expect(await slugPageData("hich-vaght-nabude")).toBeNull();
  });

  it("سرصفحه‌ی ۴۰۴ صریحاً noindex است تا صفحه‌ی نبوده ایندکس نشود", () => {
    const head = slugHead(undefined);
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(head.links).toBeUndefined();
    const html = renderToStaticMarkup(<NotFoundPanel />);
    expect(html).toContain("۴۰۴");
    expect(html).toContain("صفحه پیدا نشد");
  });
});

describe("دروازه‌ی انتشار — دارایی تک‌سکویی صفحه نمی‌گیرد", () => {
  it("دارایی با published=false ⟸ ۴۰۴", async () => {
    seed(assetStore());
    expect(await slugPageData("noghre")).toBeNull();
  });

  it("با فعال شدن سکوی دوم (پرچم گردآورنده) صفحه ساخته می‌شود — مرز وب", async () => {
    const store = assetStore();
    const now = freshIso();
    store.instruments = [
      TALA18,
      makeListing({
        slug: "noghre",
        instrument: "SILVER_990",
        name_fa: "نقره‌ی ۹۹۰",
        supporting: ["wallgold", "talasea"],
        published: true,
        purity: "990",
      }),
    ];
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      instrument: "SILVER_990",
      mid: 210000,
      fetchedAt: now,
    });
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      instrument: "SILVER_990",
      mid: 209000,
      fetchedAt: now,
    });
    seed(store);

    const html = await renderSlug("noghre");
    expect(html).toContain("قیمت نقره‌ی ۹۹۰");
    expect(html).toContain("۲۱۰٬۰۰۰");
    expect(html).toContain("۲۰۹٬۰۰۰");
  });

  it("سایت‌مپ فقط دارایی‌های دروازه‌گذشته + سکوها را دارد", () => {
    const paths = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    }).map((entry) => entry.path);
    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre");
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/digikala");
  });
});

describe("صفحه‌ی دارایی — /tala-18", () => {
  it("h1 فارسی دارد و هر سکو «قیمت» و دو کارمزد خودش را نشان می‌دهد", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");

    expect(html).toMatch(/<h1[^>]*>قیمت طلای ۱۸ عیار<\/h1>/);
    const wallgold = rowOf(html, "wallgold");
    expect(wallgold).toContain("۱۸٬۶۱۱٬۰۰۰");
    expect(wallgold).toMatch(/data-fee[^>]*>۰٫۵٪/);
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(talasea).toMatch(/data-fee[^>]*>۰٫۵٪/);
    expect(html).not.toContain("۱۸٬۷۰۴٬۰۵۵");
    expect(html).not.toContain("مؤثر");
  });

  it("ردیف‌ها صعودی بر اساس «قیمت» مرتب‌اند", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html.indexOf('data-platform="daric"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="wallgold"'),
    );
  });

  it("سکوی کارمزد-نامعلوم دیگر گروه جدا ندارد — فقط ستون کارمزدش تهی است", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html).not.toContain("کارمزد نامشخص — فقط قیمت میانی");
    expect(html.indexOf('data-platform="digikala"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    const row = rowOf(html, "digikala");
    expect(row).toContain("۱۸٬۴۰۰٬۰۰۰");
    expect(row).not.toContain("قیمت میانی");
    expect(row).toMatch(/data-fee[^>]*>—/);
    expect(row).not.toMatch(/data-fee[^>]*>۰٪/);
  });

  it("برچسب دفتر سفارش و کهنگی از تکه‌های مشترک بازاستفاده می‌شوند", async () => {
    const store = assetStore();
    store.updatedAt["daric"] = staleIso();
    seed(store);
    const html = await renderSlug("tala-18");
    const daric = rowOf(html, "daric");
    expect(daric).toContain('data-badge="order-book"');
    expect(daric).toContain("کهنه");
  });

  it("ستون قیمت صریحاً «مالِ همان سکو» توضیح داده می‌شود و سرصفحه canonical تخت دارد", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html).toContain("هیچ میانگین بین‌سکویی");

    const head = slugHead(await pageOf("tala-18"));
    expect(head.meta?.[0]).toMatchObject({ title: expect.stringContaining("طلای ۱۸ عیار") });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/tala-18`,
    });
  });

  it("جدول با هیچ سکوی پشتیبانِ داده‌دار هم ۲۰۰ می‌ماند", async () => {
    const store = assetStore();
    for (const slug of ["wallgold", "talasea", "daric", "digikala"]) {
      store.snapshots[slug] = null;
      store.updatedAt[slug] = staleIso();
    }
    seed(store);
    const html = await renderSlug("tala-18");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
  });
});

describe("صفحه‌ی سکو — /talasea و /wallgold", () => {
  it("نام، لینک وب‌سایت (با rel کامل)، شرایط، هویت حقوقی و تحویل فیزیکی را دارد", async () => {
    seed(assetStore());
    const html = await renderSlug("talasea");

    expect(html).toContain("طلاسی");
    expect(html).toContain('href="/go/talasea"');
    expect(html).not.toContain('href="https://talasea.ir"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain("کارمزد خرید");
    expect(html).toContain("۰٫۵٪");
    expect(html).toContain("رفت‌وبرگشت");
    expect(html).toContain("از API سکو");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("شرکت توسعه راهکار الوند ارسباران");
    expect(html).toContain("تحویل فیزیکی با اجرت ساخت");
    expect(html).not.toContain("۱۸٬۷۱۵٬۳۰۰");
    expect(html).not.toContain("۱۸٬۳۴۴٬۷۰۰");
    expect(html).not.toContain("قیمت‌های این سکو");
  });

  it("فراداده‌ی مستندنشده صادقانه «ثبت نشده است» می‌شود، نه جعل", async () => {
    seed(assetStore());
    const html = await renderSlug("wallgold");
    expect(html).toContain("ثبت نشده است");
  });

  it("نشان‌های باز/بسته و کهنگی روی صفحه‌ی سکو هم هستند", async () => {
    const store = assetStore();
    const now = freshIso();
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      sellEnabled: false,
      fetchedAt: now,
    });
    store.updatedAt["wallgold"] = staleIso();
    seed(store);
    const html = await renderSlug("wallgold");
    expect(html).toContain("فروش بسته است");
    expect(html).toContain("کهنه");
  });

  it("سرصفحه‌ی صفحه‌ی سکو canonical تخت دارد و Product نمی‌سازد", async () => {
    seed(assetStore());
    const head = slugHead(await pageOf("wallgold"));
    expect(head.meta?.[0]).toMatchObject({ title: expect.stringContaining("وال‌گلد") });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/wallgold`,
    });
    expect(head.scripts).toHaveLength(2);
    const raw = head.scripts?.map((script) => script.children).join("\n") ?? "";
    expect(raw).toContain("BreadcrumbList");
    expect(raw).toContain('"@type":"WebPage"');
    expect(raw).not.toContain("Product");
    expect(raw).not.toContain("AggregateOffer");
  });

  it("قطع کامل منبع ⟸ صفحه‌ی سکو ۲۰۰ می‌ماند (کهنگی، نه خطا)", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    const html = await renderSlug("talasea");
    expect(html).toContain("طلاسی");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
  });

  it("سکوی بدون هیچ مقصد خروجی، دکمه‌ی مرده نمی‌سازد", async () => {
    const store = assetStore();
    store.listed = [{ slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" }];
    seed(store);
    const data = await pageOf("wallgold");
    expect(data.kind === "platform" && data.hasOutbound).toBe(false);
    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    expect(html).not.toContain('href="/go/wallgold"');
  });
});

describe("بخش «قیمت امروز» صفحه‌ی سکو — کارمزد معلوم/نامعلوم", () => {
  it("کارت «قیمت» با تاریخ شمسی در تیتر و توضیح صریح اینکه کارمزد در آن نیست", async () => {
    const store = assetStore();
    seed(store);
    const html = await renderSlug("talasea");

    const expectedDate = formatDateFa(store.updatedAt["talasea"] as string);
    expect(html).toContain(expectedDate);

    expect(html).toContain("قیمت هر گرم (پیش از کارمزد)");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");

    expect(html).toContain("پیش از کارمزد");
    expect(html).not.toContain("دوقیمتی");
    expect(html).not.toContain("تک‌قیمتی");
  });

  it("کارمزد نامعلوم ⟸ بخش می‌آید، با قیمت و کارمزدِ «نامشخص»", async () => {
    seed(assetStore());
    const html = await renderSlug("digikala");

    expect(html).toContain("دیجی‌کالا");
    expect(html).toContain("قیمت هر گرم (پیش از کارمزد)");
    expect(html).toContain("۱۸٬۴۰۰٬۰۰۰");
    expect(html).toContain("کارمزد خرید");
    expect(html).toContain("نامشخص");
    expect(html).toContain("سکو کارمزدش را اعلام نکرده است");
  });

  it("جدول «قیمت‌های این سکو» (QuotesSection) دیگر نیست — نه برای کارمزد معلوم، نه نامعلوم", async () => {
    seed(assetStore());
    const known = await renderSlug("talasea");
    const unknown = await renderSlug("digikala");
    expect(known).not.toContain("قیمت‌های این سکو");
    expect(unknown).not.toContain("قیمت‌های این سکو");
  });

  it("نوار ماده ۵ دست‌نخورده می‌ماند", async () => {
    seed(assetStore());
    const html = await renderSlug("talasea");
    expect(html).toContain('data-legal-notice="madde-5"');
  });
});

describe("نوار «نرخ اتحادیه» صفحه‌ی سکو (تیکت ۳۳)", () => {
  it("با مرجع قیمت seed‌شده، نوار با برچسب، عدد ۱۸ عیار و زمان خوانده‌شدنش می‌آید", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice({
      reference_slug: "talair",
      instrument: "GOLD_18K_TOMAN",
      value: 18559700,
      read_at: "2026-08-07T10:00:00.000Z",
    });
    const html = await renderSlug("talasea");

    expect(html).toContain("data-union-rate");
    expect(html).toContain("نرخ اتحادیه");
    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰");
    expect(html).toContain(formatDateTimeFa("2026-08-07T10:00:00.000Z"));
  });

  it("قطع منبع مرجع (بی‌سابقه) ⟸ نوار اصلاً رندر نمی‌شود، صفحه ۲۰۰ می‌ماند", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice(null);
    const html = await renderSlug("talasea");

    expect(html).not.toContain("data-union-rate");
    expect(html).not.toContain("نرخ اتحادیه");
    expect(html).toContain("طلاسی");
  });

  it("عدد نوار به قیمت مرجع خودِ سکو نمی‌خورد — دو رشته‌ی جدا در HTML", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice({
      reference_slug: "talair",
      instrument: "GOLD_18K_TOMAN",
      value: 18559700,
      read_at: "2026-08-07T10:00:00.000Z",
    });
    const html = await renderSlug("talasea");

    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
  });
});

describe("کارت نرخ صفحه‌ی سکو — PlatformRateCard", () => {
  it("عدد درشت = «قیمت» سکو، با برچسبی که پیش-از-کارمزد بودنش را می‌گوید", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("قیمت اعلامی این سکو — پیش از کارمزد");
    expect(html).not.toContain("میانگین خرید و فروش این سکو");
  });

  it("کارمزد نامعلوم ⟸ برچسب «قیمت اعلامی این سکو»، از hasUnknownFee نه فهرست دستی", async () => {
    const store = assetStore();
    const now = freshIso();
    store.listed = [
      ...PLATFORMS,
      { slug: "melligold", name_fa: "ملی‌گلد", data_policy: "ALLOWED" },
    ];
    store.snapshots["melligold"] = makeSnapshot({
      slug: "melligold",
      mid: 18490000,
      feeSource: "UNKNOWN",
      fetchedAt: now,
    });
    store.updatedAt["melligold"] = now;
    seed(store);
    seedHistory([]);
    const html = await renderSlug("melligold");
    expect(html).toContain("قیمت اعلامی این سکو");
    expect(html).not.toContain("میانگین خرید و فروش این سکو");
  });

  it("نمودار همان سری عدد درشت را می‌کشد؛ سه آمار (تغییرات صعودی، بیشینه، کمینه) از همان سری‌اند", async () => {
    seed(assetStore());
    const history: PlatformHistory[] = [
      {
        platform_slug: "talasea",
        points: [
          { hour: "2026-08-06T09:00:00.000Z", value: 18400000 },
          { hour: "2026-08-06T15:00:00.000Z", value: 18300000 },
          { hour: "2026-08-06T21:00:00.000Z", value: 18530000 },
        ],
        latest: 18530000,
        side_used: "PRICE",
      },
    ];
    seedHistory(history);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("۱۸٬۳۰۰٬۰۰۰");
    expect(html).toContain("+۰٫۷۱٪");
    expect(html).toContain("text-positive");
  });

  it("تغییرات نزولی رنگ text-negative می‌گیرد", async () => {
    seed(assetStore());
    seedHistory([
      {
        platform_slug: "wallgold",
        points: [
          { hour: "2026-08-06T09:00:00.000Z", value: 18700000 },
          { hour: "2026-08-06T15:00:00.000Z", value: 18820000 },
          { hour: "2026-08-06T18:00:00.000Z", value: 18590000 },
          { hour: "2026-08-06T21:00:00.000Z", value: 18611000 },
        ],
        latest: 18611000,
        side_used: "PRICE",
      },
    ]);
    const html = await renderSlug("wallgold");
    expect(html).toContain("text-negative");
    expect(html).toContain("−۰٫۴۸٪");
    expect(html).toContain("۱۸٬۸۲۰٬۰۰۰");
    expect(html).toContain("۱۸٬۵۹۰٬۰۰۰");
  });

  it("سکوی بی‌تاریخچه: کارت بدون نمودار رندر می‌شود، صفحه ۲۰۰ می‌ماند", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain("هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.");
  });

  it("سکوی بی‌قیمت مرجع (بی‌اسنپ‌شات) اصلاً کارت را رندر نمی‌کند", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("data-rate-price");
    expect(html).toContain("قیمت در دسترس نیست");
  });
});

function rateCardSection(html: string): string {
  const match = html.match(/<section[^>]*aria-labelledby="rate-card-heading"[\s\S]*?<\/section>/);
  if (!match) throw new Error("کارت نرخ در HTML نیست");
  return match[0];
}

describe("شمارنده‌ی زنده و برچسب کهنگی روی کارت نرخ", () => {
  it("با داده‌ی تازه، برچسب «آخرین به‌روزرسانی» و شمارنده‌ی ۳۰ ثانیه هر دو رندر می‌شوند", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:");
    expect(card).toContain("data-rate-countdown");
    expect(card).toContain("بروزرسانی بعدی در ۳۰ ثانیه");
    expect(card).not.toContain("کهنه");
  });

  it("با داده‌ی کهنه، شمارنده رندر نمی‌شود ولی برچسب کهنگی می‌ماند", async () => {
    const store = assetStore();
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:");
    expect(card).toContain("کهنه");
    expect(card).not.toContain("data-rate-countdown");
    expect(card).not.toContain("بروزرسانی بعدی در");
  });

  it("قطع منبع (بی‌اسنپ‌شات) اصلاً کارت را رندر نمی‌کند — نه شمارنده نه برچسب زمان جعلی", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("data-rate-countdown");
    expect(html).toContain("قیمت در دسترس نیست");
  });
});

function tabButton(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  if (!match) throw new Error(`زبانه‌ی «${label}» در HTML نیست`);
  return match[0];
}

describe("نوار زبانه‌ی بازه‌ی کارت نرخ — روزانه/هفتگی/ماهانه", () => {
  it("نقش tablist دارد و روزانه پیش‌فرض زبانه‌ی فعال (aria-selected) است", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");

    expect(html).toContain('role="tablist"');
    const dailyTab = tabButton(html, "روزانه");
    expect(dailyTab).toContain('aria-selected="true"');
    expect(dailyTab).not.toContain('disabled=""');
  });

  it("پوشش کافی هفتگی ⟸ زبانه‌ی هفتگی فعال و قابل‌کلیک؛ پوشش ناکافی ماهانه ⟸ «به‌زودی» و disabled", async () => {
    seed(assetStore());
    seedHistoryByQuery((query) => {
      if (query.stepHours === 2) {
        return [
          {
            platform_slug: "talasea",
            points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
            latest: 18400000,
            side_used: "PRICE",
            has_enough_coverage: true,
          },
        ];
      }
      if (query.stepHours === 8) {
        return [
          {
            platform_slug: "talasea",
            points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
            latest: 18400000,
            side_used: "PRICE",
            has_enough_coverage: false, // کمتر از نیم پنجره — «به‌زودی»
          },
        ];
      }
      return [];
    });
    const html = await renderSlug("talasea");

    const weeklyTab = tabButton(html, "هفتگی");
    expect(weeklyTab).not.toContain('disabled=""');
    expect(weeklyTab).toContain('aria-selected="false"');

    const comingSoonTab = tabButton(html, "به‌زودی");
    expect(comingSoonTab).toContain('disabled=""');
    expect(comingSoonTab).toContain('aria-disabled="true"');
    expect(html).not.toContain(">ماهانه<");
  });

  it("ناحیه‌ی سه آمار aria-live دارد — تعویض زبانه عدد را برای صفحه‌خوان اعلام می‌کند", async () => {
    seed(assetStore());
    seedHistory([
      {
        platform_slug: "talasea",
        points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
        latest: 18400000,
        side_used: "PRICE",
      },
    ]);
    const html = await renderSlug("talasea");
    expect(html).toContain('aria-live="polite"');
  });
});

describe("سایت‌مپ — فقط صفحات دروازه‌گذشته", () => {
  it("دارایی منتشرشده و سکوها را دارد؛ دارایی تک‌سکویی غایب است؛ بدون lastmod", () => {
    const entries = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    });
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre");
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/talasea");

    for (const path of ["/tala-18", "/wallgold"]) {
      expect(entries.find((entry) => entry.path === path)?.lastModified).toBeUndefined();
    }
  });
});
