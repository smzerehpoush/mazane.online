/**
 * مرز وب: استور seed شده ⟸ HTML رندرشده‌ی صفحه‌ی اصلی.
 *
 * منبع داده با `setPriceSource` تزریق می‌شود؛ هیچ ردیس/پستگرس/شبکه‌ای در کار
 * نیست. اعداد seed همان شکل JSON کانونی گردآورنده‌اند (pydantic
 * model_dump_json) — قیمت‌های مؤثر و «قیمت مرجع سکو» از قبل آنجا محاسبه
 * شده‌اند و وب فقط انتخابشان می‌کند (قاعده‌ی ۱ قراردادها).
 *
 * فهرست سکوها (`getListedPlatforms`) همان داده‌ای است که گردآورنده نوشته:
 * از قبل فیلترشده. گلدیکا ممکن است در استور باشد ولی هرگز در فهرست نیست.
 *
 * طرح تازه (تصمیم مالک ۲۰۲۶-۰۸-۰۶): چیپ‌های پنج سکوی ثابت، نمودار ۲۴ ساعته،
 * دو کارت «بهترین خرید/فروش»، و جدول **دقیقاً چهارستونی** (نام سکو، قیمت
 * خرید، قیمت فروش، دکمه‌ی رفتن به سایت) با ترتیب صعودی ستون خرید.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import { fa } from "../src/lib/site-content";
import type { PlatformHistory } from "../src/lib/history";
import { REGISTRY_PLATFORMS } from "../src/lib/registry";
import {
  freshIso,
  healthyStore,
  homeData,
  LISTED,
  makeSnapshot,
  rowOf,
  staleIso,
  storeWithUnknownFee,
} from "./support/seed";

async function renderHome(...args: Parameters<typeof homeData>): Promise<string> {
  return renderToStaticMarkup(<HomePage data={await homeData(...args)} />);
}

/**
 * نام صفت در HTML حساس به حروف نیست (React 19 آن را dateTime می‌نویسد و
 * مرورگر/خزنده datetime می‌خواند)؛ پس تطبیق بدون حساسیت به حروف درست است.
 */
function timeTagPattern(iso: string): RegExp {
  const escaped = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<time [^>]*datetime="${escaped}"`, "i");
}

/** سلول‌های ‎<td>‎ یک ردیف، به ترتیب ستون‌ها. */
function cellsOf(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1] ?? "");
}

/** متن خالص گره‌ی رقم یک کارت «بهترین» — بدون واحد و بدون هیچ تگی. */
function bestCardPrice(html: string, side: "buy" | "sell"): string {
  const card = html.match(new RegExp(`data-best="${side}"[\\s\\S]*?</p>`));
  if (card === null) throw new Error(`کارت ${side} در HTML نیست`);
  const digits = card[0].match(/data-best-price[^>]*>([\s\S]*?)<\/div>/);
  if (digits === null) throw new Error(`گره‌ی رقم کارت ${side} در HTML نیست`);
  return (digits[1] ?? "").replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "").trim();
}

function srcOf(relative: string): string {
  return readFileSync(join(__dirname, "..", relative), "utf8");
}

describe("صفحه‌ی اصلی — جدول قیمت و کارمزد", () => {
  it("وال‌گلد، طلاسی و میلی را با «قیمت» خودشان و ارقام فارسی نشان می‌دهد", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("طلاسی");
    expect(html).toContain("میلی");
    // عدد اعلامی خود سکو، پیش از کارمزد — نه ضربِ mid×(1±f) (سند تصمیم ۰۰۰۲).
    expect(html).toContain("۱۸٬۶۱۱٬۰۰۰"); // وال‌گلد
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // طلاسی
    expect(html).toContain("۱۸٬۵۳۸٬۰۰۰"); // میلی
  });

  it("هر ردیف پنج ستون دارد: قیمت، دو کارمزد و دکمه‌ی خروجی کنار نام سکو", async () => {
    const html = await renderHome(healthyStore());
    const cells = cellsOf(rowOf(html, "wallgold"));
    expect(cells).toHaveLength(5);
    expect(cells[0]).toContain("وال‌گلد");
    expect(cells[1]).toContain("۱۸٬۶۱۱٬۰۰۰"); // ستون قیمت — پیش از کارمزد
    expect(cells[2]).toContain("۰٫۵٪"); // کارمزد خرید
    expect(cells[3]).toContain("۰٫۵٪"); // کارمزد فروش
    expect(cells[4]).toContain('href="/go/wallgold"');
  });

  it("نام سکو پیوند داخلی به مسیر تخت خودش است، جدا از دکمه‌ی خروجی (بلیت ۲۸)", async () => {
    const html = await renderHome(healthyStore());
    const cells = cellsOf(rowOf(html, "wallgold"));
    // سلول نام: پیوند داخلی به /wallgold، نه به /go/wallgold.
    expect(cells[0]).toContain('href="/wallgold"');
    expect(cells[0]).not.toContain('href="/go/wallgold"');
    // دکمه‌ی خروجی همچنان دست‌نخورده در آخرین سلول است.
    expect(cells[4]).toContain('href="/go/wallgold"');
  });

  it("سرستون‌ها همان پنج عنوان تصمیم مالک‌اند و ستون ششمی نیست", async () => {
    const html = await renderHome(healthyStore());
    const headers = [...html.matchAll(/<th\b[^>]*scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
      (m[1] ?? "").replace(/<[^>]+>/g, "").trim(),
    );
    expect(headers).toEqual([
      "سکو",
      "قیمت",
      "کارمزد خرید",
      "کارمزد فروش",
      "رفتن به سایت سکو",
    ]);
  });

  it("ردیف‌ها بر اساس «قیمت» صعودی مرتب‌اند، نه بر اساس کارمزد", async () => {
    const html = await renderHome(healthyStore());
    // طلاسی (۱۸٬۵۳۰٬۰۰۰) < میلی (۱۸٬۵۳۸٬۰۰۰) < وال‌گلد (۱۸٬۶۱۱٬۰۰۰)
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="milli"'),
    );
    expect(html.indexOf('data-platform="milli"')).toBeLessThan(
      html.indexOf('data-platform="wallgold"'),
    );
  });

  it("ارزان‌ترین ردیف نشان می‌گیرد و همان برنده‌ی کارت «کمترین قیمت» است", async () => {
    const html = await renderHome(healthyStore());
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain('data-cheapest="true"');
    expect(talasea).toContain("ارزان‌ترین");
    // هیچ ردیف دیگری نشان ارزان‌ترین نمی‌گیرد.
    expect(html.match(/data-cheapest="true"/g)).toHaveLength(1);
  });

  it("گلدیکا در استور هست ولی هرگز رندر نمی‌شود (PERMISSION_PENDING)", async () => {
    const store = healthyStore();
    // پیش‌شرط: اسنپ‌شات گلدیکا واقعاً در استور موجود است.
    expect(store.snapshots["goldika"]).not.toBeNull();
    const html = await renderHome(store);
    expect(html).not.toContain("گلدیکا");
    expect(html).not.toContain("۱۸٬۵۶۰٬۰۰۰"); // قیمت گلدیکا
  });

  it("در استور سالم هیچ ردیفی برچسب کهنگی ندارد", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("کهنه");
  });
});

describe("صفحه‌ی اصلی — نشان «ارزان‌ترین» (قاعده‌ی ۴)", () => {
  /**
   * کارت‌های «کمترین/بیشترین قیمت» در ۲۰۲۶-۰۸-۱۰ به‌کلی حذف شدند (تصمیم
   * مالک). با رفتن قیمت مؤثر، آن کارت‌ها دو سرِ یک ستون مرتب‌شده را تکرار
   * می‌کردند و چیزی به جدول اضافه نمی‌کردند. نشان «ارزان‌ترین» ماند، چون
   * ردیف اول را برای کاربری که ستون را نمی‌خواند علامت می‌زند.
   */
  it("فقط یک ردیف نشان می‌گیرد و همان ارزان‌ترینِ قابل‌خرید است", async () => {
    const html = await renderHome(healthyStore());
    expect(rowOf(html, "talasea")).toContain('data-cheapest="true"');
    expect(html.match(/data-cheapest="true"/g)).toHaveLength(1);
  });

  it("سکویی که خریدش بسته است نشان نمی‌گیرد، حتی اگر ارزان‌ترین باشد", async () => {
    const store = healthyStore();
    const now = freshIso();
    // طلاسی ارزان‌ترین است؛ خریدش را می‌بندیم ⟸ نشان باید به میلی برسد.
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      buyEnabled: false,
      fetchedAt: now,
    });
    const html = await renderHome(store);
    expect(rowOf(html, "talasea")).not.toContain('data-cheapest="true"');
    expect(rowOf(html, "milli")).toContain('data-cheapest="true"');
  });

  it("کامپوننت کارت‌ها دیگر وجود ندارد", () => {
    expect(existsSync(join(__dirname, "..", "src/components/tablo/BestCards.tsx"))).toBe(
      false,
    );
  });
});

describe("صفحه‌ی اصلی — سکوی «کارمزد نامشخص» (تصمیم مالک: بدون برچسب)", () => {
  it("قیمتش در ستون قیمت می‌نشیند و کارمزدش «—» می‌شود، نه «۰٪»", async () => {
    const html = await renderHome(storeWithUnknownFee());
    const cells = cellsOf(rowOf(html, "digikala"));
    expect(cells[1]).toContain("۱۸٬۵۲۰٬۰۰۰");
    // تهی یعنی اعلام‌نشده؛ صفر یعنی می‌دانیم کارمزدی نیست. این دو یکی نیستند.
    expect(cells[2]).toContain("—");
    expect(cells[3]).toContain("—");
    expect(cells[2]).not.toContain("۰٪");
    expect(rowOf(html, "digikala")).not.toContain("قیمت میانی");
    expect(rowOf(html, "digikala")).not.toContain("اسمی");
  });

  it("در همان فهرست مرتب می‌شود و ته جدول تبعید نمی‌شود", async () => {
    const html = await renderHome(storeWithUnknownFee());
    // ۱۸٬۵۲۰٬۰۰۰ کمترین قیمت است ⟸ ردیف اول، و نشان «ارزان‌ترین» را می‌گیرد.
    // در مدل قبلی این سکو گروه جداگانه‌ای ته جدول داشت.
    expect(rowOf(html, "digikala")).toContain("ارزان‌ترین");
    expect(html.indexOf('data-platform="digikala"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
  });
});

describe("صفحه‌ی اصلی — چیپ‌های پنج سکوی ثابت نمودار", () => {
  it("قیمت مرجع هر سکو در HTML سروری است (خزنده جاوااسکریپت لازم ندارد)", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain('data-platform-chip="milli"');
    expect(html).toContain('data-platform-chip="wallgold"');
    expect(html).toContain("۱۸٬۶۱۱٬۰۰۰ تومان"); // مرجع وال‌گلد از اسنپ‌شات
    expect(html).toContain("۱۸٬۵۳۸٬۰۰۰ تومان"); // مرجع میلی
  });

  it("سکوی بی‌هیچ داده چیپ محو با برچسب «به‌زودی» می‌گیرد، نه عدد جعلی", async () => {
    const html = await renderHome(healthyStore());
    // ملی‌گلد و طلاین در فهرست این استور نیستند و سری هم ندارند.
    for (const slug of ["melligold", "tlyn"]) {
      const chip = html.match(new RegExp(`data-platform-chip="${slug}"[\\s\\S]*?</div>`));
      expect(chip?.[0]).toContain("به‌زودی");
    }
    expect(html).toContain("به‌زودی");
  });

  it("سکوی با کارمزد نامعلوم دیگر برچسب «اسمی» نمی‌گیرد — همه‌ی اعداد اسمی‌اند", async () => {
    const store = storeWithUnknownFee();
    const now = freshIso();
    // ملی‌گلد یکی از پنج سکوی ثابت نمودار است؛ کارمزدش اعلام نشده.
    store.listed = [...LISTED, { slug: "melligold", name_fa: "ملی‌گلد", data_policy: "ALLOWED" }];
    store.snapshots["melligold"] = makeSnapshot({
      slug: "melligold",
      mid: 18490000,
      feeSource: "UNKNOWN",
      fetchedAt: now,
    });
    store.updatedAt["melligold"] = now;
    const html = await renderHome(store);
    const chip = html.match(/data-platform-chip="melligold"[\s\S]*?<\/div>\s*<\/div>/);
    // تفکیک «اسمی/مؤثر» با حذف قیمت مؤثر موضوعش را از دست داد (سند تصمیم ۰۰۰۲).
    expect(chip?.[0]).not.toContain("اسمی");
    expect(chip?.[0]).toContain("۱۸٬۴۹۰٬۰۰۰");
  });
});

describe("صفحه‌ی اصلی — نمودار ۲۴ ساعته", () => {
  it("بدون سری، پیام کهنگی رندر می‌شود نه خطا و نه جعبه‌ی خالی", async () => {
    const html = await renderHome(healthyStore(), { history: [] });
    expect(html).toContain("هنوز سابقه‌ی ۲۴ ساعته‌ای");
    expect(html).toContain("مظنه‌ی مرجع هر گرم طلای ۱۸ عیار");
  });

  it("با سری موجود هم صفحه سالم رندر می‌شود (بوم بعد از hydration کشیده می‌شود)", async () => {
    const history: PlatformHistory[] = [
      {
        platform_slug: "milli",
        points: [
          { hour: "2026-08-06T09:00:00.000Z", value: 18500000 },
          { hour: "2026-08-06T10:00:00.000Z", value: 18538000 },
        ],
        latest: 18538000,
        side_used: "PRICE",
      },
    ];
    const html = await renderHome(healthyStore(), { history });
    expect(html).not.toContain("هنوز سابقه‌ی ۲۴ ساعته‌ای");
    expect(html).toContain('data-platform-chip="milli"');
  });
});

describe("صفحه‌ی اصلی — برچسب «دفتر سفارش» (بند ۹.۲)", () => {
  it("سکوی ORDER_BOOK برچسب می‌گیرد و سکوهای OTC نمی‌گیرند", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.listed = [
      ...LISTED,
      {
        slug: "daric",
        name_fa: "داریک",
        data_policy: "ALLOWED",
        market_model: "ORDER_BOOK",
      },
    ];
    store.snapshots["daric"] = makeSnapshot({
      slug: "daric",
      mid: 18501633,
      fetchedAt: now,
    });
    store.updatedAt["daric"] = now;

    const html = await renderHome(store);

    expect(rowOf(html, "daric")).toContain('data-badge="order-book"');
    expect(rowOf(html, "daric")).toContain("دفتر سفارش");
    // غیبت فیلد = OTC (payload پیش از مهاجرت ۰۰۴) — بدون برچسب.
    expect(rowOf(html, "wallgold")).not.toContain('data-badge="order-book"');
  });
});

/**
 * ⚠️ رگرسیون: این نشان‌ها در جدول اپ نکست قبلی بودند و در بازنویسی از جدول
 * صفحه‌ی اصلی افتادند (کامپوننتشان زنده ماند ولی صدا زده نمی‌شد). بند ۱۳
 * تصمیم ۱۹ صریح است: وضعیت باز/بسته‌ی خرید و فروش مزیت رقابتی است و روی
 * همین تک‌صفحه به‌صورت نشان می‌آید. بدون آنها عدد سکوی بسته خوانده می‌شود
 * انگار قابل معامله است.
 */
describe("صفحه‌ی اصلی — نشان‌های «خرید بسته» / «فروش بسته» (بند ۹.۲)", () => {
  it("سکوی خریدبسته نشانش را در همان ردیف جدول می‌گیرد و ردیفش حذف نمی‌شود", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      buyEnabled: false,
      fetchedAt: now,
    });
    const html = await renderHome(store);
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain('data-badge="buy-closed"');
    expect(talasea).toContain("خرید بسته است");
    // قیمتش هم سر جایش می‌ماند — نشان است، نه حذف.
    expect(cellsOf(talasea)[1]).toContain("۱۸٬۵۳۰٬۰۰۰");
  });

  it("سکوی فروش‌بسته نشان فروش می‌گیرد و سکوی باز هیچ نشانی نمی‌گیرد", async () => {
    const store = healthyStore();
    const now = freshIso();
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      sellEnabled: false,
      fetchedAt: now,
    });
    const html = await renderHome(store);
    expect(rowOf(html, "wallgold")).toContain('data-badge="sell-closed"');
    expect(rowOf(html, "wallgold")).toContain("فروش بسته است");
    expect(rowOf(html, "wallgold")).not.toContain('data-badge="buy-closed"');
    // میلی هر دو سمتش باز است ⟸ هیچ نشان بسته‌ای.
    expect(rowOf(html, "milli")).not.toContain("بسته است");
  });

  it("منبع قطع ⟸ هیچ نشانی ادعا نمی‌شود (قاعده‌ی ۵)", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    const html = await renderHome(store);
    expect(rowOf(html, "talasea")).not.toContain("بسته است");
  });
});

describe("صفحه‌ی اصلی — قطع منبع ⟸ کهنگی، نه خطا (قاعده‌ی ۵)", () => {
  it("با مردن یک منبع صفحه رندر می‌شود و همان ردیف برچسب کهنگی می‌گیرد", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null; // TTL قیمت جاری گذشته
    store.updatedAt["talasea"] = staleIso(); // ولی updated_at بدون TTL مانده

    const html = await renderHome(store);

    // صفحه نمی‌شکند و بقیه‌ی سکوها سر جایشان هستند.
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("میلی");
    // ردیف طلاسی هست، بی‌قیمت، با برچسب کهنگی — حذف نمی‌شود.
    expect(html).toContain("طلاسی");
    expect(rowOf(html, "talasea")).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
    expect(html).toContain("دقیقه پیش");
  });

  it("ردیف بی‌قیمت آخر جدول می‌ماند ولی حذف نمی‌شود", async () => {
    const store = healthyStore();
    store.snapshots["milli"] = null; // ارزان‌ترین بود
    store.updatedAt["milli"] = staleIso();
    const html = await renderHome(store);
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="milli"'),
    );
  });

  it("منبع بدون هیچ سابقه‌ای هم صفحه را نمی‌شکند", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = null;

    const html = await renderHome(store);
    expect(html).toContain("طلاسی");
    expect(html).toContain("هنوز داده‌ای ثبت نشده است");
  });

  /**
   * فهرست سکوها فراداده‌ی ثابت است، نه قیمت (`lib/registry.ts`): در قطع
   * کامل هم ردیف‌ها سر جایشان می‌مانند و فقط ستون قیمتشان «قیمت در دسترس
   * نیست» می‌شود — همان چیزی که قاعده‌ی ۵ می‌خواهد. جدولِ کاملاً خالی
   * («هنوز داده‌ای ثبت نشده») دیگر رخ نمی‌دهد.
   */
  it("قطع کامل هر سه منبع ⟸ صفحه باز هم رندر می‌شود، با ردیف‌های بی‌قیمت", async () => {
    const html = await renderHome({ listed: [], snapshots: {}, updatedAt: {} });
    expect(html).toContain("مقایسه‌ی سکوهای خرید و فروش طلا");
    expect(html).toContain("قیمت در دسترس نیست");
    for (const platform of REGISTRY_PLATFORMS) {
      expect(html, platform.slug).toContain(`data-platform="${platform.slug}"`);
    }
  });

  it("برچسب زمان هر ردیف با <time datetime> در خود HTML است", async () => {
    const store = healthyStore();
    const iso = store.updatedAt["wallgold"] as string;
    const html = await renderHome(store);
    expect(html).toContain("به‌روزرسانی");
    expect(html).toMatch(timeTagPattern(iso));
  });
});

describe("صفحه‌ی اصلی — بخش‌های بلاگ (تصمیم مالک: جعبه‌ی خالی نه)", () => {
  it("بدون پست، ستون کناری و بخش پایانی اصلاً رندر نمی‌شوند", async () => {
    const html = await renderHome(healthyStore(), { posts: [] });
    expect(html).not.toContain("تازه‌ترین نوشته‌ها");
    expect(html).not.toContain("بیشتر بخوانید");
  });

  it("با پست منتشرشده هر دو بخش می‌آیند و لینکشان داخلی است", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "hazine-raft-o-bargasht",
          title_fa: "هزینه‌ی رفت‌وبرگشت چیست؟",
          body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.",
          status: "published",
          published_at: "2026-08-01T09:00:00.000Z",
          updated_at: "2026-08-01T09:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("تازه‌ترین نوشته‌ها");
    expect(html).toContain("بیشتر بخوانید");
    expect(html).toContain('href="/blog/hazine-raft-o-bargasht"');
    // چکیده از بدنه‌ی خود پست برداشته می‌شود، ساخته نمی‌شود.
    expect(html).toContain("هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.");
  });

  it("پیش‌نویس هرگز به صفحه‌ی اصلی نمی‌رسد", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "pish-nevis",
          title_fa: "پیش‌نویس منتشرنشده",
          body_md: "هنوز در صف است.",
          status: "draft",
          published_at: null,
          updated_at: "2026-08-03T12:00:00.000Z",
        },
      ],
    });
    expect(html).not.toContain("پیش‌نویس منتشرنشده");
  });

  it("عکس شاخص در ستون کناری و کارت‌های پایانی: img با src/width/height/alt (بلیت ۲۵)", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "hazine-raft-o-bargasht",
          title_fa: "هزینه‌ی رفت‌وبرگشت چیست؟",
          body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.",
          status: "published",
          published_at: "2026-08-01T09:00:00.000Z",
          updated_at: "2026-08-01T09:00:00.000Z",
          image_url: "https://s3.tablo.test/tablo-media/posts/hazine/h.webp",
          image_alt: "هزینه‌ی رفت‌وبرگشت طلا",
          image_width: 1600,
          image_height: 900,
        },
      ],
    });
    expect(html).toMatch(
      /<img[^>]*src="https:\/\/s3\.tablo\.test\/tablo-media\/posts\/hazine\/h\.webp"[^>]*>/,
    );
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('alt="هزینه‌ی رفت‌وبرگشت طلا"');
  });

  it("پستِ بدون عکس شاخص: نه در ستون کناری نه در کارت‌های پایانی img نیست", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "hazine-raft-o-bargasht",
          title_fa: "هزینه‌ی رفت‌وبرگشت چیست؟",
          body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.",
          status: "published",
          published_at: "2026-08-01T09:00:00.000Z",
          updated_at: "2026-08-01T09:00:00.000Z",
        },
      ],
    });
    expect(html).not.toContain("<img");
  });
});

describe("پوسته‌ی ریشه — فارسی و راست‌به‌چپ (قاعده‌ی ۶)", () => {
  /**
   * ⚠️ نگهبان سطح کد، نه رندر. `RootShell` از `HeadContent`/`Scripts` استفاده
   * می‌کند و بدون `RouterProvider` رندر نمی‌شود (تجربی سنجیده شد: «useRouter
   * must be used inside a RouterProvider»). رندر واقعیِ ‎<html lang="fa"
   * dir="rtl">‎ با سرور بیلدشده راستی‌آزمایی شد؛ این نگهبان جلوی حذف
   * بی‌سروصدای همان صفت‌ها را در بازنویسی بعدی می‌گیرد.
   */
  it("پوسته‌ی ریشه lang=fa و dir=rtl دارد", () => {
    const source = readFileSync(join(__dirname, "..", "src/routes/__root.tsx"), "utf8");
    expect(source).toMatch(/<html\s+lang="fa"\s+dir="rtl">/);
  });
});

describe("صفحه‌ی اصلی — نوار ماده ۵ و یادداشت حقوقی (بند ۷.۲)", () => {
  it("صفحه لینک ‎/go/‎ دارد ⟸ نوار ماده ۵ در HTML سروری است", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain('data-legal-notice="madde-5"');
    expect(html).toContain("معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود");
    expect(html).toContain("تابلو معامله‌گر یا مشاور سرمایه‌گذاری نیست.");
  });
});
