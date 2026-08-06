/**
 * مرز وب: استور seed شده ⟸ HTML رندرشده‌ی صفحه‌ی اصلی.
 *
 * منبع داده با `setPriceSource` تزریق می‌شود؛ هیچ ردیس/شبکه‌ای در کار نیست.
 * اعداد seed همان شکل JSON کانونی گردآورنده‌اند (pydantic model_dump_json)
 * — قیمت‌های مؤثر از قبل در گردآورنده محاسبه شده‌اند.
 *
 * فهرست سکوها (`getListedPlatforms`) همان داده‌ای است که گردآورنده نوشته:
 * از قبل فیلترشده. گلدیکا ممکن است در استور باشد ولی هرگز در فهرست نیست.
 *
 * بلیت ۶ — نمای تک‌عددی (بند ۱۳، تصمیم ۱۸): مرتب‌سازی صعودی بر اساس مؤثر
 * خرید، دلتا نسبت به ارزان‌ترین، گروه «کارمزد نامشخص» بعد از همه‌ی ردیف‌های
 * معلوم، نشان باز/بسته، جزئیات بازشونده، و جایگاه‌های تبلیغ با ارتفاع ثابت
 * که فعلاً «پیشنهاد سردبیر» را نشان می‌دهند (تصمیم‌های ۹ و ۱۵).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import RootLayout from "../app/layout";
import Home from "../app/page";
import { formatDateFa } from "../lib/format";
import {
  setPriceSource,
  type FeeSource,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
  type Side,
} from "../lib/prices";

const MILLI_FEE_OBSERVED_AT = "2026-08-05T00:00:00+00:00";

function quote(
  slug: string,
  side: Side,
  priceToman: number,
  fetchedAt: string,
): Quote {
  return {
    platform_slug: slug,
    instrument: "GOLD_18K",
    side,
    price_toman: priceToman,
    raw_value: String(priceToman),
    raw_scale: "1",
    fetched_at: fetchedAt,
  };
}

function makeSnapshot(opts: {
  slug: string;
  mid: number;
  /** برای fee_source=UNKNOWN نده — گردآورنده برای آن سکوها فقط MID می‌نویسد. */
  buy?: number;
  sell?: number;
  feeSource?: FeeSource;
  feeObservedAt?: string;
  fetchedAt?: string;
  buyFee?: string;
  sellFee?: string;
  roundTrip?: string;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  minOrderToman?: string;
}): PlatformSnapshot {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
  const feeSource = opts.feeSource ?? "API";
  const unknown = feeSource === "UNKNOWN";
  const quotes: Quote[] = [quote(opts.slug, "MID", opts.mid, fetchedAt)];
  if (!unknown && opts.buy !== undefined) {
    quotes.push(quote(opts.slug, "BUY", opts.buy, fetchedAt));
  }
  if (!unknown && opts.sell !== undefined) {
    quotes.push(quote(opts.slug, "SELL", opts.sell, fetchedAt));
  }
  return {
    platform_slug: opts.slug,
    quotes,
    terms: {
      platform_slug: opts.slug,
      // کارمزد UNKNOWN یعنی هر سه تهی — عدد نصفه‌نیمه در گردآورنده باگ است.
      buy_fee_percent: unknown ? null : (opts.buyFee ?? "0.5"),
      sell_fee_percent: unknown ? null : (opts.sellFee ?? "0.5"),
      round_trip_percent: unknown ? null : (opts.roundTrip ?? "0.9950"),
      fee_source: feeSource,
      buy_enabled: opts.buyEnabled ?? true,
      sell_enabled: opts.sellEnabled ?? true,
      observed_at: opts.feeObservedAt ?? fetchedAt,
      ...(opts.minOrderToman !== undefined
        ? { min_order_toman: opts.minOrderToman }
        : {}),
    },
    fetched_at: fetchedAt,
    suppressed: false,
  };
}

const LISTED: ListedPlatform[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" },
  { slug: "talasea", name_fa: "طلاسی", data_policy: "ALLOWED" },
  { slug: "milli", name_fa: "میلی", data_policy: "ALLOWED" },
];

const DIGIKALA: ListedPlatform = {
  slug: "digikala",
  name_fa: "دیجی‌کالا",
  data_policy: "ALLOWED",
};

function freshIso(): string {
  return new Date(Date.now() - 30_000).toISOString(); // ۳۰ ثانیه پیش — تازه
}

function staleIso(): string {
  return new Date(Date.now() - 10 * 60_000).toISOString(); // ۱۰ دقیقه پیش — کهنه
}

interface SeededStore {
  listed?: ListedPlatform[];
  snapshots: Record<string, PlatformSnapshot | null>;
  updatedAt: Record<string, string | null>;
}

function seed(store: SeededStore): void {
  setPriceSource({
    getListedPlatforms: async () => store.listed ?? LISTED,
    getSnapshot: async (slug) => store.snapshots[slug] ?? null,
    getUpdatedAt: async (slug) => store.updatedAt[slug] ?? null,
  });
}

/** استور سالم: هر سه سکوی فهرست‌شده تازه + گلدیکا هم در استور (ولی نه در فهرست). */
function healthyStore(): SeededStore {
  const now = freshIso();
  return {
    snapshots: {
      wallgold: makeSnapshot({ slug: "wallgold", mid: 18611000, buy: 18704055, sell: 18517945, fetchedAt: now }),
      talasea: makeSnapshot({ slug: "talasea", mid: 18530000, buy: 18715300, sell: 18344700, fetchedAt: now }),
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        buy: 18630690,
        sell: 18445310,
        feeSource: "MANUAL",
        feeObservedAt: MILLI_FEE_OBSERVED_AT,
        fetchedAt: now,
      }),
      goldika: makeSnapshot({ slug: "goldika", mid: 18514235, buy: 18736406, sell: 18292064, fetchedAt: now }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now, goldika: now },
  };
}

/** استور سالم + دیجی‌کالا با کارمزد UNKNOWN: فقط MID، بدون هیچ عدد کارمزد. */
function storeWithUnknownFee(): SeededStore {
  const store = healthyStore();
  const now = freshIso();
  store.listed = [...LISTED, DIGIKALA];
  // mid دیجی‌کالا عمداً از همه‌ی مؤثرخریدها پایین‌تر است تا ثابت شود ترتیب
  // گروه از عدد اثر نمی‌گیرد: نامشخص همیشه بعد از همه‌ی معلوم‌ها.
  store.snapshots.digikala = makeSnapshot({
    slug: "digikala",
    mid: 18520000,
    feeSource: "UNKNOWN",
    fetchedAt: now,
  });
  store.updatedAt.digikala = now;
  return store;
}

/**
 * نام صفت در HTML حساس به حروف نیست (React 19 آن را dateTime می‌نویسد و
 * مرورگر/خزنده datetime می‌خواند)؛ پس تطبیق بدون حساسیت به حروف درست است.
 */
function timeTagPattern(iso: string): RegExp {
  const escaped = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<time [^>]*datetime="${escaped}"`, "i");
}

/** ردیف اصلی یک سکو (تا اولین ‎</tr>‎ — ردیف جزئیات جدا است). */
function rowOf(html: string, slug: string): string {
  const match = html.match(
    new RegExp(`<tr[^>]*data-platform="${slug}"[\\s\\S]*?</tr>`),
  );
  if (!match) throw new Error(`ردیف ${slug} در HTML نیست`);
  return match[0];
}

/** ردیف جزئیات بازشونده‌ی یک سکو. */
function detailsOf(html: string, slug: string): string {
  const match = html.match(
    new RegExp(`<tr[^>]*data-details-for="${slug}"[\\s\\S]*?</tr>`),
  );
  if (!match) throw new Error(`جزئیات ${slug} در HTML نیست`);
  return match[0];
}

/** جایگاه تبلیغ (aside) بالای جدول یا زیر آن. */
function adSlotOf(html: string, position: "top" | "bottom"): string {
  const match = html.match(
    new RegExp(`<aside[^>]*data-ad-slot="${position}"[\\s\\S]*?</aside>`),
  );
  if (!match) throw new Error(`جایگاه تبلیغ ${position} در HTML نیست`);
  return match[0];
}

describe("صفحه‌ی اصلی — جدول چندسکویی", () => {
  it("وال‌گلد، طلاسی و میلی را با قیمت مؤثر و ارقام فارسی نشان می‌دهد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("طلاسی");
    expect(html).toContain("میلی");
    expect(html).toContain("۱۸٬۷۰۴٬۰۵۵"); // مؤثر خرید وال‌گلد
    expect(html).toContain("۱۸٬۷۱۵٬۳۰۰"); // مؤثر خرید طلاسی
    expect(html).toContain("۱۸٬۶۳۰٬۶۹۰"); // مؤثر خرید میلی
    expect(html).toContain("۱۸٬۴۴۵٬۳۱۰"); // مؤثر فروش میلی
  });

  it("پرسش تک‌عددی تیتر صفحه است (تصمیم ۱۸)", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("برای یک گرم طلا چقدر می‌پردازی؟");
  });

  it("ردیف‌ها بر اساس قیمت مؤثر خرید صعودی مرتب‌اند", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    // میلی (۱۸٬۶۳۰٬۶۹۰) < وال‌گلد (۱۸٬۷۰۴٬۰۵۵) < طلاسی (۱۸٬۷۱۵٬۳۰۰)
    const tbody = html.slice(html.indexOf("<tbody"));
    expect(tbody.indexOf("میلی")).toBeGreaterThan(-1);
    expect(tbody.indexOf("میلی")).toBeLessThan(tbody.indexOf("وال‌گلد"));
    expect(tbody.indexOf("وال‌گلد")).toBeLessThan(tbody.indexOf("طلاسی"));
  });

  it("گلدیکا در استور هست ولی هرگز رندر نمی‌شود (PERMISSION_PENDING)", async () => {
    const store = healthyStore();
    seed(store);
    // پیش‌شرط: اسنپ‌شات گلدیکا واقعاً در استور موجود است.
    expect(store.snapshots.goldika).not.toBeNull();
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain("گلدیکا");
    expect(html).not.toContain("۱۸٬۷۳۶٬۴۰۶"); // مؤثر خرید گلدیکا
  });

  it("کارمزد دستی میلی برچسب «دستی» و تاریخ مشاهده دارد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("دستی");
    expect(html).toContain(formatDateFa(MILLI_FEE_OBSERVED_AT));
  });

  it("در استور سالم هیچ ردیفی برچسب کهنگی ندارد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain("کهنه");
  });
});

describe("صفحه‌ی اصلی — دلتا نسبت به ارزان‌ترین (تصمیم ۱۸)", () => {
  it("ارزان‌ترین ردیف برجسته است و دلتای صفر دارد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    const milli = rowOf(html, "milli");
    expect(milli).toContain("data-cheapest");
    expect(milli).toContain("ارزان‌ترین");
    expect(milli).toContain("۰ تومان");
  });

  it("دلتای هر ردیف — تومان و درصد — نسبت به ارزان‌ترین درست است", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    // وال‌گلد: ۱۸٬۷۰۴٬۰۵۵ − ۱۸٬۶۳۰٬۶۹۰ = ۷۳٬۳۶۵ (~۰٫۳۹٪)
    const wallgold = rowOf(html, "wallgold");
    expect(wallgold).toContain("۷۳٬۳۶۵");
    expect(wallgold).toContain("۰٫۳۹٪");
    // طلاسی: ۱۸٬۷۱۵٬۳۰۰ − ۱۸٬۶۳۰٬۶۹۰ = ۸۴٬۶۱۰ (~۰٫۴۵٪)
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain("۸۴٬۶۱۰");
    expect(talasea).toContain("۰٫۴۵٪");
  });

  it("ردیف کهنه سر جای مرتب‌سازی‌اش می‌ماند و فقط برچسب کهنگی می‌گیرد", async () => {
    const store = healthyStore();
    store.updatedAt.wallgold = staleIso(); // قیمت هست ولی به‌روزرسانی عقب است
    seed(store);
    const html = renderToStaticMarkup(await Home());
    // ترتیب همان صعودی قیمت است: میلی < وال‌گلد < طلاسی
    expect(html.indexOf('data-platform="milli"')).toBeLessThan(
      html.indexOf('data-platform="wallgold"'),
    );
    expect(html.indexOf('data-platform="wallgold"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    expect(rowOf(html, "wallgold")).toContain("کهنه");
  });
});

describe("صفحه‌ی اصلی — گروه «کارمزد نامشخص»", () => {
  it("سکوی UNKNOWN بعد از همه‌ی ردیف‌های معلوم می‌آید، حتی با mid پایین‌تر", async () => {
    seed(storeWithUnknownFee());
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("کارمزد نامشخص");
    // دیجی‌کالا (mid = ۱۸٬۵۲۰٬۰۰۰ — از همه پایین‌تر) بعد از گران‌ترین معلوم.
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="digikala"'),
    );
  });

  it("ردیف UNKNOWN قیمت میانی را با برچسب نشان می‌دهد، بدون دلتا", async () => {
    seed(storeWithUnknownFee());
    const html = renderToStaticMarkup(await Home());
    const row = rowOf(html, "digikala");
    expect(row).toContain("۱۸٬۵۲۰٬۰۰۰");
    expect(row).toContain("قیمت میانی");
    expect(row).not.toContain("٪"); // دلتا ندارد — با مؤثرها هم‌مقایسه نیست
  });

  it("جزئیات UNKNOWN «نامشخص» می‌گوید و هیچ عدد کارمزدی جعل نمی‌کند", async () => {
    seed(storeWithUnknownFee());
    const html = renderToStaticMarkup(await Home());
    const details = detailsOf(html, "digikala");
    expect(details).toContain("نامشخص");
    // هیچ درصدی (کارمزد/رفت‌وبرگشت ساختگی) در جزئیات نیست.
    expect(details).not.toMatch(/[۰-۹]+[٫]?[۰-۹]*٪/);
  });
});

describe("صفحه‌ی اصلی — نشان باز/بسته از buy_enabled/sell_enabled", () => {
  it("سکویی که فروشش بسته است نشان «فروش بسته است» می‌گیرد", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.snapshots.talasea = makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      buy: 18715300,
      sell: 18344700,
      sellEnabled: false,
      fetchedAt: now,
    });
    seed(store);
    const html = renderToStaticMarkup(await Home());
    expect(rowOf(html, "talasea")).toContain("فروش بسته است");
    expect(rowOf(html, "wallgold")).not.toContain("بسته است");
  });

  it("سکویی که خریدش بسته است نشان «خرید بسته است» می‌گیرد", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      buy: 18704055,
      sell: 18517945,
      buyEnabled: false,
      fetchedAt: now,
    });
    seed(store);
    const html = renderToStaticMarkup(await Home());
    expect(rowOf(html, "wallgold")).toContain("خرید بسته است");
  });
});

describe("صفحه‌ی اصلی — جزئیات بازشونده (بدون جاوااسکریپت)", () => {
  it("جزئیات با عنصر <details> رندر می‌شود و کارمزدها و رفت‌وبرگشت را دارد", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("<details");
    const details = detailsOf(html, "wallgold");
    expect(details).toContain("کارمزد خرید");
    expect(details).toContain("کارمزد فروش");
    expect(details).toContain("۰٫۵٪");
    expect(details).toContain("رفت‌وبرگشت");
    expect(details).toContain("۰٫۹۹۵٪");
    // مؤثر فروش در جزئیات است (نمای تک‌عددی — تصمیم ۱۸).
    expect(details).toContain("۱۸٬۵۱۷٬۹۴۵");
  });

  it("حداقل سفارش فقط وقتی در payload هست نمایش داده می‌شود", async () => {
    // غایب (حالت فعلی گردآورنده) ⟸ اصلاً ردیفی برای حداقل سفارش نیست.
    seed(healthyStore());
    const without = renderToStaticMarkup(await Home());
    expect(without).not.toContain("حداقل سفارش");

    // موجود ⟸ با ارقام فارسی نمایش داده می‌شود.
    const store = healthyStore();
    const now = freshIso();
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      buy: 18704055,
      sell: 18517945,
      minOrderToman: "500000",
      fetchedAt: now,
    });
    seed(store);
    const withMin = renderToStaticMarkup(await Home());
    const details = detailsOf(withMin, "wallgold");
    expect(details).toContain("حداقل سفارش");
    expect(details).toContain("۵۰۰٬۰۰۰");
  });
});

describe("صفحه‌ی اصلی — جایگاه تبلیغ با ارتفاع ثابت (تصمیم‌های ۹ و ۱۵)", () => {
  it("دو جایگاه (بالای جدول و زیر آن) با ارتفاع ثابت رندر می‌شوند", async () => {
    seed(healthyStore());
    const html = renderToStaticMarkup(await Home());
    for (const position of ["top", "bottom"] as const) {
      const slot = adSlotOf(html, position);
      expect(slot).toMatch(/height:96px/);
      expect(slot).toContain("پیشنهاد سردبیر");
      expect(slot).toContain('href="/darbare-pishnahad"');
    }
  });

  it("پیشنهاد سردبیر = کمترین رفت‌وبرگشت میان کارمزدهای API با خریدوفروش باز", async () => {
    const store = healthyStore();
    const now = freshIso();
    // میلی MANUAL با کمترین رفت‌وبرگشت است ولی واجد معیار نیست (فقط API).
    store.snapshots.milli = makeSnapshot({
      slug: "milli",
      mid: 18538000,
      buy: 18630690,
      sell: 18445310,
      feeSource: "MANUAL",
      roundTrip: "0.5000",
      fetchedAt: now,
    });
    store.snapshots.talasea = makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      buy: 18715300,
      sell: 18344700,
      roundTrip: "1.9800",
      fetchedAt: now,
    });
    seed(store);
    const html = renderToStaticMarkup(await Home());
    // وال‌گلد (API، ۰٫۹۹۵٪) کمترین رفت‌وبرگشت واجد معیار است.
    expect(adSlotOf(html, "top")).toContain("وال‌گلد");
  });

  it("سکویی که یک سمتش بسته است هرگز پیشنهاد سردبیر نمی‌شود", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      buy: 18704055,
      sell: 18517945,
      sellEnabled: false, // فروش بسته ⟸ از معیار خارج
      fetchedAt: now,
    });
    store.snapshots.talasea = makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      buy: 18715300,
      sell: 18344700,
      roundTrip: "1.9800",
      fetchedAt: now,
    });
    seed(store);
    const html = renderToStaticMarkup(await Home());
    const slot = adSlotOf(html, "top");
    expect(slot).not.toContain("وال‌گلد");
    expect(slot).toContain("طلاسی");
  });
});

describe("صفحه‌ی اصلی — قطع منبع ⟸ کهنگی، نه خطا", () => {
  it("با مردن یک منبع صفحه رندر می‌شود و همان ردیف برچسب کهنگی می‌گیرد", async () => {
    const store = healthyStore();
    store.snapshots.talasea = null; // TTL قیمت جاری گذشته
    store.updatedAt.talasea = staleIso(); // ولی updated_at بدون TTL مانده
    seed(store);

    const html = renderToStaticMarkup(await Home());

    // صفحه نمی‌شکند و بقیه‌ی سکوها سر جایشان هستند.
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("میلی");
    // ردیف طلاسی هست، بی‌قیمت، با برچسب کهنگی.
    expect(html).toContain("طلاسی");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
    expect(html).toContain("دقیقه پیش");
  });

  it("منبع بدون هیچ سابقه‌ای هم صفحه را نمی‌شکند", async () => {
    const store = healthyStore();
    store.snapshots.talasea = null;
    store.updatedAt.talasea = null;
    seed(store);

    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("طلاسی");
    expect(html).toContain("هنوز داده‌ای ثبت نشده است");
  });

  it("برچسب زمان هر ردیف با <time datetime> در خود HTML است", async () => {
    const store = healthyStore();
    const iso = store.updatedAt.wallgold as string;
    seed(store);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("به‌روزرسانی");
    expect(html).toMatch(timeTagPattern(iso));
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

describe("صفحه‌ی اصلی — برچسب «دفتر سفارش» (بند ۹.۲)", () => {
  it("سکوی ORDER_BOOK برچسب دفتر سفارش می‌گیرد و سکوهای OTC نمی‌گیرند", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.listed = [
      ...LISTED,
      { slug: "daric", name_fa: "داریک", data_policy: "ALLOWED", market_model: "ORDER_BOOK" },
    ];
    store.snapshots.daric = makeSnapshot({
      slug: "daric",
      mid: 18501633,
      buy: 18579884,
      sell: 18423383,
      fetchedAt: now,
    });
    store.updatedAt.daric = now;
    seed(store);

    const html = renderToStaticMarkup(await Home());

    expect(rowOf(html, "daric")).toContain('data-badge="order-book"');
    expect(rowOf(html, "daric")).toContain("دفتر سفارش");
    // غیبت فیلد = OTC (payload پیش از مهاجرت ۰۰۴) — بدون برچسب.
    expect(rowOf(html, "wallgold")).not.toContain('data-badge="order-book"');
  });
});
