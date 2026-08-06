/**
 * مرز وب: استور seed شده ⟸ HTML رندرشده‌ی صفحه‌ی اصلی.
 *
 * منبع داده با `setPriceSource` تزریق می‌شود؛ هیچ ردیس/شبکه‌ای در کار نیست.
 * اعداد seed همان شکل JSON کانونی گردآورنده‌اند (pydantic model_dump_json)
 * — قیمت‌های مؤثر از قبل در گردآورنده محاسبه شده‌اند.
 *
 * فهرست سکوها (`getListedPlatforms`) همان داده‌ای است که گردآورنده نوشته:
 * از قبل فیلترشده. گلدیکا ممکن است در استور باشد ولی هرگز در فهرست نیست.
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
  buy: number;
  sell: number;
  feeSource?: FeeSource;
  feeObservedAt?: string;
  fetchedAt?: string;
}): PlatformSnapshot {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString();
  return {
    platform_slug: opts.slug,
    quotes: [
      quote(opts.slug, "MID", opts.mid, fetchedAt),
      quote(opts.slug, "BUY", opts.buy, fetchedAt),
      quote(opts.slug, "SELL", opts.sell, fetchedAt),
    ],
    terms: {
      platform_slug: opts.slug,
      buy_fee_percent: "0.5",
      sell_fee_percent: "0.5",
      round_trip_percent: "0.9950",
      fee_source: opts.feeSource ?? "API",
      buy_enabled: true,
      sell_enabled: true,
      observed_at: opts.feeObservedAt ?? fetchedAt,
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

/**
 * نام صفت در HTML حساس به حروف نیست (React 19 آن را dateTime می‌نویسد و
 * مرورگر/خزنده datetime می‌خواند)؛ پس تطبیق بدون حساسیت به حروف درست است.
 */
function timeTagPattern(iso: string): RegExp {
  const escaped = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<time [^>]*datetime="${escaped}"`, "i");
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
