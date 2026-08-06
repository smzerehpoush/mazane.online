/**
 * مرز وب — بلیت ۷: استور seed شده ⟸ صفحه‌ی دارایی، صفحه‌ی سکو، حل‌کننده‌ی
 * اسلاگ تخت، دروازه‌ی انتشار و سایت‌مپ.
 *
 * همه‌ی اعداد از قبل در گردآورنده «مؤثر»/«مرجع» شده‌اند (تصمیم ۱۹) و پرچم
 * دروازه (`published`) هم آنجا محاسبه شده (تصمیم ۱۰) — این تست‌ها فقط
 * می‌سنجند که وب همان داده را درست رندر/رد می‌کند و هیچ عدد بین‌سکویی‌ای
 * نمی‌سازد.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import SlugPage, {
  generateMetadata,
  generateStaticParams,
} from "../app/[slug]/page";
import sitemap from "../app/sitemap";
import { setBlogSource } from "../lib/blog";
import type { InstrumentListing, ListedPlatform } from "../lib/prices";
import { SITE_URL } from "../lib/site";
import { isReservedSlug, resolveSlug } from "../lib/slugs";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  rowOf,
  seed,
  staleIso,
  type SeededStore,
} from "./support/seed";

/** خطای notFound نکست — digest بسته به نسخه NEXT_NOT_FOUND یا ‎…;404 است. */
const NOT_FOUND_DIGEST = /NEXT_NOT_FOUND|404/;

function pageProps(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

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
      // مرجع هر سکو = میانگین مؤثر خرید/فروش خودش — عدد آماده‌ی گردآورنده.
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

function seedBlogEmpty(): void {
  setBlogSource({ listPosts: async () => [], getPost: async () => null });
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
    }
    // صفحه‌ی ایستای سطح ریشه هم هرگز از مسیر داینامیک حل نمی‌شود.
    expect(await resolveSlug("darbare-pishnahad")).toBeNull();
  });

  it("اسلاگ دارایی ⟸ دارایی، اسلاگ سکو ⟸ سکو، ناشناخته ⟸ null", async () => {
    seed(assetStore());
    const asset = await resolveSlug("tala-18");
    expect(asset?.kind).toBe("instrument");
    const platform = await resolveSlug("wallgold");
    expect(platform?.kind).toBe("platform");
    expect(await resolveSlug("hich-vaght-nabude")).toBeNull();
  });

  it("اسلاگ ناشناخته در خود صفحه 404 می‌دهد", async () => {
    seed(assetStore());
    await expect(SlugPage(pageProps("hich-vaght-nabude"))).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
  });
});

describe("دروازه‌ی انتشار — دارایی تک‌سکویی صفحه نمی‌گیرد (تصمیم ۱۰)", () => {
  it("دارایی با published=false ⟸ 404", async () => {
    seed(assetStore());
    await expect(SlugPage(pageProps("noghre"))).rejects.toMatchObject({
      digest: expect.stringMatching(NOT_FOUND_DIGEST),
    });
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
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      instrument: "SILVER_990",
      mid: 210000,
      buy: 211050,
      sell: 208950,
      reference: 210000,
      fetchedAt: now,
    });
    store.snapshots.talasea = makeSnapshot({
      slug: "talasea",
      instrument: "SILVER_990",
      mid: 209000,
      buy: 210045,
      sell: 207955,
      reference: 209000,
      fetchedAt: now,
    });
    seed(store);

    const html = renderToStaticMarkup(await SlugPage(pageProps("noghre")));
    expect(html).toContain("<h1>قیمت نقره‌ی ۹۹۰</h1>");
    expect(html).toContain("۲۱۱٬۰۵۰"); // مؤثر خرید وال‌گلد
    expect(html).toContain("۲۱۰٬۰۴۵"); // مؤثر خرید طلاسی
  });

  it("generateStaticParams فقط دارایی‌های دروازه‌گذشته + سکوها را می‌دهد", async () => {
    seed(assetStore());
    const slugs = (await generateStaticParams()).map((p) => p.slug);
    expect(slugs).toContain("tala-18");
    expect(slugs).not.toContain("noghre"); // دروازه بسته
    expect(slugs).toContain("wallgold");
    expect(slugs).toContain("digikala");
  });
});

describe("صفحه‌ی دارایی — /tala-18 (تصمیم ۱۹)", () => {
  it("h1 فارسی دارد و هر سکو مؤثر خرید، مؤثر فروش و قیمت مرجع خودش را نشان می‌دهد", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));

    expect(html).toContain("<h1>قیمت طلای ۱۸ عیار</h1>");
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
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
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
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
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
    store.updatedAt.daric = staleIso();
    seed(store);
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    const daric = rowOf(html, "daric");
    expect(daric).toContain('data-badge="order-book"');
    expect(daric).toContain("کهنه");
  });

  it("قیمت مرجع صریحاً «مالِ همان سکو» توضیح داده می‌شود و متادیتا canonical تخت دارد", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    expect(html).toContain("هیچ میانگین بین‌سکویی");

    const metadata = await generateMetadata(pageProps("tala-18"));
    expect(metadata.title).toContain("طلای ۱۸ عیار");
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/tala-18`);
  });
});

describe("صفحه‌ی سکو — /talasea و /wallgold", () => {
  it("نام، لینک وب‌سایت (با rel کامل)، شرایط، هویت حقوقی و تحویل فیزیکی را دارد", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("talasea")));

    expect(html).toContain("طلاسی");
    // TODO بلیت ۹ لینک /go/ می‌شود؛ تا آن موقع لینک مستقیم با rel کامل بند ۶.۴.
    expect(html).toContain('href="https://talasea.ir"');
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
    const html = renderToStaticMarkup(await SlugPage(pageProps("wallgold")));
    expect(html).toContain("ثبت نشده است");
  });

  it("نشان‌های باز/بسته و کهنگی روی صفحه‌ی سکو هم هستند", async () => {
    const store = assetStore();
    const now = freshIso();
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      buy: 18704055,
      sell: 18517945,
      reference: 18611000,
      sellEnabled: false,
      fetchedAt: now,
    });
    store.updatedAt.wallgold = staleIso();
    seed(store);
    const html = renderToStaticMarkup(await SlugPage(pageProps("wallgold")));
    expect(html).toContain("فروش بسته است");
    expect(html).toContain("کهنه");
  });

  it("متادیتای صفحه‌ی سکو canonical تخت دارد", async () => {
    seed(assetStore());
    const metadata = await generateMetadata(pageProps("wallgold"));
    expect(metadata.title).toContain("وال‌گلد");
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/wallgold`);
  });

  it("قطع کامل منبع ⟸ صفحه‌ی سکو ۲۰۰ می‌ماند (کهنگی، نه خطا)", async () => {
    const store = assetStore();
    store.snapshots.talasea = null;
    store.updatedAt.talasea = staleIso();
    seed(store);
    const html = renderToStaticMarkup(await SlugPage(pageProps("talasea")));
    expect(html).toContain("طلاسی");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
  });
});

describe("سایت‌مپ — فقط صفحات دروازه‌گذشته (بند ۶.۷ + تصمیم ۱۰)", () => {
  it("دارایی منتشرشده و سکوها را دارد؛ دارایی تک‌سکویی غایب است؛ بدون lastmod", async () => {
    seedBlogEmpty();
    seed(assetStore());
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/tala-18`);
    expect(urls).not.toContain(`${SITE_URL}/noghre`); // دروازه بسته ⟸ غایب
    expect(urls).toContain(`${SITE_URL}/wallgold`);
    expect(urls).toContain(`${SITE_URL}/talasea`);

    // نوسان قیمت lastmod نیست: صفحات دارایی/سکو اصلاً lastModified ندارند.
    for (const url of [`${SITE_URL}/tala-18`, `${SITE_URL}/wallgold`]) {
      const entry = entries.find((e) => e.url === url);
      expect(entry?.lastModified).toBeUndefined();
    }
  });
});
