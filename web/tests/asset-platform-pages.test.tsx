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
    // قیمت‌های خود سکو با نام فارسی دارایی:
    expect(html).toContain("طلای ۱۸ عیار");
    expect(html).toContain("۱۸٬۷۱۵٬۳۰۰");
    expect(html).toContain("۱۸٬۳۴۴٬۷۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // قیمت مرجع خودش
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
    // ما فروشنده نیستیم: فقط BreadcrumbList.
    expect(head.scripts).toHaveLength(1);
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
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
