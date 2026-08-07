/**
 * مرز وب — بلیت ۷: استور seed شده ⟸ صفحه‌ی دارایی، صفحه‌ی سکو، حل‌کننده‌ی
 * اسلاگ تخت، دروازه‌ی انتشار و سایت‌مپ.
 *
 * همه‌ی اعداد از قبل در گردآورنده «مؤثر»/«مرجع» شده‌اند (تصمیم ۱۹) و پرچم
 * دروازه (`published`) هم آنجا محاسبه شده (تصمیم ۱۰) — این تست‌ها فقط
 * می‌سنجند که وب همان داده را درست رندر/رد می‌کند و هیچ عدد بین‌سکویی‌ای
 * نمی‌سازد.
 *
 * مسیر ‎src/routes/$slug.tsx‎ فقط سیم‌کشی است (لودر + ۴۰۴ + پوسته)؛ نما و
 * سرصفحه در `components/content/SlugPageView.tsx` اند و همین‌جا سنجیده
 * می‌شوند. «۴۰۴» در این مرز یعنی `slugPageData(...) === null` — مسیر همان را
 * به `notFound()` ترجمه می‌کند.
 */
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

/** دارایی تک‌سکویی — گردآورنده دروازه را بسته اعلام کرده (تصمیم ۱۰). */
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
      // مرجع هر سکو = عدد آماده‌ی گردآورنده برای همان سکو (تصمیم ۱۹).
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        buy: 18704055,
        sell: 18517945,
        reference: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        buy: 18715300,
        sell: 18344700,
        reference: 18530000,
        fetchedAt: now,
      }),
      daric: makeSnapshot({
        slug: "daric",
        mid: 18501633,
        buy: 18579884,
        sell: 18423383,
        reference: 18501634,
        fetchedAt: now,
      }),
      // کارمزد نامعلوم: فقط MID و **بدون** قیمت مرجع (جعل نمی‌شود).
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

/** داده‌ی صفحه را می‌خواند و اگر ۴۰۴ باشد تست را می‌شکند. */
async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
  return data;
}

async function renderSlug(slug: string): Promise<string> {
  return renderToStaticMarkup(<SlugPageView data={await pageOf(slug)} />);
}

describe("حل‌کننده‌ی اسلاگ تخت (تصمیم ۱۱)", () => {
  it("کلمات رزرو را رد می‌کند — حتی اگر payload آن اسلاگ را ادعا کند", async () => {
    const store = assetStore();
    // payload آلوده‌ی فرضی: دارایی/سکویی که اسلاگ رزروشده برداشته است.
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
    // صفحه‌ی ایستای سطح ریشه هم هرگز از مسیر داینامیک حل نمی‌شود.
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

describe("دروازه‌ی انتشار — دارایی تک‌سکویی صفحه نمی‌گیرد (تصمیم ۱۰)", () => {
  it("دارایی با published=false ⟸ ۴۰۴", async () => {
    seed(assetStore());
    expect(await slugPageData("noghre")).toBeNull();
  });

  it("با فعال شدن سکوی دوم (پرچم گردآورنده) صفحه ساخته می‌شود — مرز وب", async () => {
    const store = assetStore();
    const now = freshIso();
    // همان دارایی، حالا دوسکویی: گردآورنده published=true نوشته است.
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
      buy: 211050,
      sell: 208950,
      reference: 210000,
      fetchedAt: now,
    });
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      instrument: "SILVER_990",
      mid: 209000,
      buy: 210045,
      sell: 207955,
      reference: 209000,
      fetchedAt: now,
    });
    seed(store);

    const html = await renderSlug("noghre");
    expect(html).toContain("قیمت نقره‌ی ۹۹۰");
    expect(html).toContain("۲۱۱٬۰۵۰"); // مؤثر خرید وال‌گلد
    expect(html).toContain("۲۱۰٬۰۴۵"); // مؤثر خرید طلاسی
  });

  it("سایت‌مپ فقط دارایی‌های دروازه‌گذشته + سکوها را دارد", () => {
    const paths = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    }).map((entry) => entry.path);
    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre"); // دروازه بسته
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/digikala");
  });
});

describe("صفحه‌ی دارایی — /tala-18 (تصمیم ۱۹)", () => {
  it("h1 فارسی دارد و هر سکو مؤثر خرید، مؤثر فروش و قیمت مرجع خودش را نشان می‌دهد", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");

    expect(html).toMatch(/<h1[^>]*>قیمت طلای ۱۸ عیار<\/h1>/);
    const wallgold = rowOf(html, "wallgold");
    expect(wallgold).toContain("۱۸٬۷۰۴٬۰۵۵"); // مؤثر خرید
    expect(wallgold).toContain("۱۸٬۵۱۷٬۹۴۵"); // مؤثر فروش
    expect(wallgold).toContain("۱۸٬۶۱۱٬۰۰۰"); // قیمت مرجع خودِ وال‌گلد
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain("۱۸٬۷۱۵٬۳۰۰");
    expect(talasea).toContain("۱۸٬۳۴۴٬۷۰۰");
    expect(talasea).toContain("۱۸٬۵۳۰٬۰۰۰");
  });

  it("ردیف‌ها صعودی بر اساس مؤثر خرید مرتب‌اند", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    // داریک (۱۸٬۵۷۹٬۸۸۴) < وال‌گلد (۱۸٬۷۰۴٬۰۵۵) < طلاسی (۱۸٬۷۱۵٬۳۰۰)
    expect(html.indexOf('data-platform="daric"')).toBeLessThan(
      html.indexOf('data-platform="wallgold"'),
    );
    expect(html.indexOf('data-platform="wallgold"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
  });

  it("سکوی کارمزد-نامعلوم در گروه جدا: قیمت میانی، بدون قیمت مرجع جعلی", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html).toContain("کارمزد نامشخص");
    // دیجی‌کالا (mid از همه پایین‌تر) باز هم بعد از همه‌ی معلوم‌ها.
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="digikala"'),
    );
    const row = rowOf(html, "digikala");
    expect(row).toContain("۱۸٬۴۰۰٬۰۰۰");
    expect(row).toContain("قیمت میانی");
    expect(row).toMatch(/data-reference-price[^>]*>—/);
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

  it("قیمت مرجع صریحاً «مالِ همان سکو» توضیح داده می‌شود و سرصفحه canonical تخت دارد", async () => {
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
    // بلیت ۹ (تصمیم ۲۱): لینک وب‌سایت از ‎/go/‎ می‌گذرد، با rel کامل بند ۶.۴؛
    // لینک مستقیم دیگر هرگز در HTML نمی‌آید.
    expect(html).toContain('href="/go/talasea"');
    expect(html).not.toContain('href="https://talasea.ir"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
    // شرایط تجاری با منبع کارمزد:
    expect(html).toContain("کارمزد خرید");
    expect(html).toContain("۰٫۵٪");
    expect(html).toContain("رفت‌وبرگشت");
    expect(html).toContain("از API سکو");
    // هویت حقوقی و تحویل فیزیکی مستندشده:
    expect(html).toContain("شرکت توسعه راهکار الوند ارسباران");
    expect(html).toContain("تحویل فیزیکی با اجرت ساخت");
    // قیمت مؤثر خرید/فروش خودِ سکو (بلیت ۳۲: دو کارت «قیمت امروز»):
    expect(html).toContain("۱۸٬۷۱۵٬۳۰۰");
    expect(html).toContain("۱۸٬۳۴۴٬۷۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // قیمت مرجع خودش (کارت قهرمان)
    // بلیت ۲۶: جدول «قیمت‌های این سکو» (QuotesSection، همه‌ی دارایی‌ها) حذف شده.
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
      buy: 18704055,
      sell: 18517945,
      reference: 18611000,
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
    // ما فروشنده نیستیم: هیچ Product/AggregateOffer در هیچ اسکریپتی نیست —
    // فقط BreadcrumbList و WebPage (بلیت ۲۹؛ جزئیاتش در structured-data.test.tsx).
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

describe("بخش «قیمت امروز» صفحه‌ی سکو — کارمزد معلوم/نامعلوم (بلیت ۳۲)", () => {
  it("کارمزد معلوم ⟸ دو کارت خرید/فروش کنار هم با تاریخ شمسی در تیتر و توضیح صادقانه‌ی منبع کارمزد", async () => {
    const store = assetStore();
    seed(store);
    const html = await renderSlug("talasea");

    // تیتر بخش با تاریخ شمسی همان به‌روزرسانی سکو (formatDateFa، نه ساخته‌ی تست).
    const expectedDate = formatDateFa(store.updatedAt["talasea"] as string);
    expect(html).toContain(expectedDate);

    // دو کارت خرید/فروش، هرکدام قیمت مؤثر خودِ سکو (انتخاب، نه محاسبه).
    expect(html).toContain("قیمت مؤثر خرید هر گرم");
    expect(html).toContain("قیمت مؤثر فروش هر گرم");
    expect(html).toContain("۱۸٬۷۱۵٬۳۰۰"); // مؤثر خرید طلاسی
    expect(html).toContain("۱۸٬۳۴۴٬۷۰۰"); // مؤثر فروش طلاسی

    // توضیح صادقانه‌ی منبع کارمزد — عمومی، بدون ادعای تک/دوقیمتی که کد
    // نمی‌تواند تأیید کند (سند تیکت ۳۲).
    expect(html).toContain("کارمزد از فاصله‌ی خرید و فروش همین سکو می‌آید");
    expect(html).not.toContain("دوقیمتی");
    expect(html).not.toContain("تک‌قیمتی");
  });

  it("کارمزد نامعلوم ⟸ بخش اصلاً نمی‌آید — نه «نامشخص»، نه صفر، نه کارت خالی", async () => {
    seed(assetStore());
    const html = await renderSlug("digikala");

    expect(html).toContain("دیجی‌کالا");
    expect(html).not.toContain("قیمت مؤثر خرید هر گرم");
    expect(html).not.toContain("قیمت مؤثر فروش هر گرم");
    expect(html).not.toContain("کارمزد خرید");
    expect(html).not.toContain("کارمزد فروش");
    expect(html).not.toContain("هزینه‌ی رفت‌وبرگشت");
    expect(html).not.toContain("منبع کارمزد");
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
    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰"); // عدد آماده‌ی مرجع، بدون هیچ محاسبه‌ای
    expect(html).toContain(formatDateTimeFa("2026-08-07T10:00:00.000Z"));
  });

  it("قطع منبع مرجع (بی‌سابقه) ⟸ نوار اصلاً رندر نمی‌شود، صفحه ۲۰۰ می‌ماند", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice(null);
    const html = await renderSlug("talasea");

    expect(html).not.toContain("data-union-rate");
    expect(html).not.toContain("نرخ اتحادیه");
    expect(html).toContain("طلاسی"); // صفحه همچنان کامل رندر می‌شود
  });

  it("عدد نوار به قیمت مرجع خودِ سکو نمی‌خورد — دو رشته‌ی جدا در HTML", async () => {
    seed(assetStore());
    seedHistory([]);
    // مقداری عمداً متفاوت از قیمت مرجع طلاسی (۱۸٬۵۳۰٬۰۰۰) تا اثبات شود این
    // عدد مستقل است و به‌جای قیمت هیچ سکویی نمی‌نشیند (قاعده‌ی ۴ قراردادها).
    seedReferencePrice({
      reference_slug: "talair",
      instrument: "GOLD_18K_TOMAN",
      value: 18559700,
      read_at: "2026-08-07T10:00:00.000Z",
    });
    const html = await renderSlug("talasea");

    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰"); // نرخ اتحادیه
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // قیمت مرجع خودِ طلاسی، همچنان جدا
  });
});

describe("کارت نرخ صفحه‌ی سکو — PlatformRateCard (بلیت ۲۷)", () => {
  it("عدد درشت = referencePriceFor؛ کارمزد معلوم ⟸ «میانگین خرید و فروش این سکو»", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // قیمت مرجع خودِ طلاسی (تصمیم ۱۹)
    expect(html).toContain("میانگین خرید و فروش این سکو");
  });

  it("کارمزد نامعلوم ⟸ برچسب «قیمت اعلامی این سکو»، از hasUnknownFee نه فهرست دستی", async () => {
    const store = assetStore();
    const now = freshIso();
    // سکوی کارمزد-نامعلوم که گردآورنده برایش قیمت مرجع (همان قیمت اسمی، تصمیم
    // مالک ۲۰۲۶-۰۸-۰۶) نوشته — بر خلاف دیجی‌کالای assetStore که اصلاً مرجع
    // ندارد و کارتش رندر نمی‌شود (آزموده در «سکوی بی‌قیمت مرجع» پایین‌تر).
    store.listed = [...PLATFORMS, { slug: "melligold", name_fa: "ملی‌گلد", data_policy: "ALLOWED" }];
    store.snapshots["melligold"] = makeSnapshot({
      slug: "melligold",
      mid: 18490000,
      feeSource: "UNKNOWN",
      reference: 18490000,
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
        side_used: "MEAN",
      },
    ];
    seedHistory(history);
    const html = await renderSlug("talasea");
    expect(html).not.toContain(
      "هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.",
    );
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // بیشینه‌ی سری
    expect(html).toContain("۱۸٬۳۰۰٬۰۰۰"); // کمینه‌ی سری
    expect(html).toContain("۱۳۰٬۰۰۰"); // تغییرات: نقطه‌ی آخر منهای نقطه‌ی اول
    expect(html).toContain("text-positive"); // صعود — سبز
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
        side_used: "MEAN",
      },
    ]);
    const html = await renderSlug("wallgold");
    expect(html).toContain("text-negative");
    expect(html).toContain("۸۹٬۰۰۰"); // |۱۸۶۱۱۰۰۰ - ۱۸۷۰۰۰۰۰|
    expect(html).toContain("۱۸٬۸۲۰٬۰۰۰"); // بیشینه‌ی سری
    expect(html).toContain("۱۸٬۵۹۰٬۰۰۰"); // کمینه‌ی سری
  });

  it("سکوی بی‌تاریخچه: کارت بدون نمودار رندر می‌شود، صفحه ۲۰۰ می‌ماند (قاعده‌ی ۵)", async () => {
    seed(assetStore());
    seedHistory([]); // منبع تاریخچه در دسترس ولی هیچ سکویی سابقه ندارد
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain(
      "هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.",
    );
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

/** ناحیه‌ی خودِ کارت نرخ در HTML رندرشده — تا تست‌ها با بقیه‌ی صفحه قاطی نشوند. */
function rateCardSection(html: string): string {
  const match = html.match(
    /<section[^>]*aria-labelledby="rate-card-heading"[\s\S]*?<\/section>/,
  );
  if (!match) throw new Error("کارت نرخ در HTML نیست");
  return match[0];
}

describe("شمارنده‌ی زنده و برچسب کهنگی روی کارت نرخ (بلیت ۳۱)", () => {
  it("با داده‌ی تازه، برچسب «آخرین به‌روزرسانی» و شمارنده‌ی ۳۰ ثانیه هر دو رندر می‌شوند", async () => {
    seed(assetStore()); // updatedAt همه‌ی سکوها freshIso است — تازه
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:"); // برچسب «آخرین به‌روزرسانی» — همیشه حاضر
    expect(card).toContain("data-rate-countdown");
    expect(card).toContain("بروزرسانی بعدی در ۳۰ ثانیه");
    expect(card).not.toContain("کهنه");
  });

  it("با داده‌ی کهنه، شمارنده رندر نمی‌شود ولی برچسب کهنگی می‌ماند", async () => {
    const store = assetStore();
    store.updatedAt["talasea"] = staleIso(); // اسنپ‌شات همچنان هست، فقط زمانش کهنه
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:"); // برچسب کهنگی هم زیرمجموعه‌ی همین متن است
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
    expect(html).toContain("قیمت در دسترس نیست"); // صفحه ۲۰۰ می‌ماند، متن صادقانه (قاعده‌ی ۵)
  });
});

/** برچسب یک زبانه در HTML رندرشده — روزانه/هفتگی/ماهانه یا «به‌زودی». */
function tabButton(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  if (!match) throw new Error(`زبانه‌ی «${label}» در HTML نیست`);
  return match[0];
}

describe("نوار زبانه‌ی بازه‌ی کارت نرخ — روزانه/هفتگی/ماهانه (بلیت ۳۰)", () => {
  it("نقش tablist دارد و روزانه پیش‌فرض زبانه‌ی فعال (aria-selected) است", async () => {
    seed(assetStore());
    seedHistory([]); // هیچ بازه‌ای سابقه ندارد — روزانه با این حال زبانه‌ی فعال می‌ماند
    const html = await renderSlug("talasea");

    expect(html).toContain('role="tablist"');
    const dailyTab = tabButton(html, "روزانه");
    expect(dailyTab).toContain('aria-selected="true"');
    expect(dailyTab).not.toContain('disabled=""');
  });

  it("پوشش کافی هفتگی ⟸ زبانه‌ی هفتگی فعال و قابل‌کلیک؛ پوشش ناکافی ماهانه ⟸ «به‌زودی» و disabled", async () => {
    seed(assetStore());
    // پرس‌وجوی هر بازه با stepHours خودش تشخیص داده می‌شود: هفتگی=۲، ماهانه=۸.
    seedHistoryByQuery((query) => {
      if (query.stepHours === 2) {
        return [
          {
            platform_slug: "talasea",
            points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
            latest: 18400000,
            side_used: "MEAN",
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
            side_used: "MEAN",
            has_enough_coverage: false, // کمتر از نیم پنجره — «به‌زودی»
          },
        ];
      }
      return []; // روزانه — بی‌ربط به این سنجش
    });
    const html = await renderSlug("talasea");

    const weeklyTab = tabButton(html, "هفتگی");
    expect(weeklyTab).not.toContain('disabled=""');
    expect(weeklyTab).toContain('aria-selected="false"');

    const comingSoonTab = tabButton(html, "به‌زودی");
    expect(comingSoonTab).toContain('disabled=""');
    expect(comingSoonTab).toContain('aria-disabled="true"');
    expect(html).not.toContain(">ماهانه<"); // برچسبش با «به‌زودی» عوض شده
  });

  it("ناحیه‌ی سه آمار aria-live دارد — تعویض زبانه عدد را برای صفحه‌خوان اعلام می‌کند", async () => {
    seed(assetStore());
    seedHistory([
      {
        platform_slug: "talasea",
        points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
        latest: 18400000,
        side_used: "MEAN",
      },
    ]);
    const html = await renderSlug("talasea");
    expect(html).toContain('aria-live="polite"');
  });
});

describe("سایت‌مپ — فقط صفحات دروازه‌گذشته (بند ۶.۷ + تصمیم ۱۰)", () => {
  it("دارایی منتشرشده و سکوها را دارد؛ دارایی تک‌سکویی غایب است؛ بدون lastmod", () => {
    const entries = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    });
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre"); // دروازه بسته ⟸ غایب
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/talasea");

    // نوسان قیمت lastmod نیست: صفحات دارایی/سکو اصلاً lastModified ندارند.
    for (const path of ["/tala-18", "/wallgold"]) {
      expect(entries.find((entry) => entry.path === path)?.lastModified).toBeUndefined();
    }
  });
});
