/**
 * مرز وب: استور seed شده ⟸ HTML رندرشده‌ی صفحه‌ی اصلی.
 *
 * منبع داده با `setPriceSource` تزریق می‌شود؛ هیچ ردیس/پستگرس/شبکه‌ای در کار
 * نیست. اعداد seed همان شکل JSON کانونی گردآورنده‌اند و وب فقط انتخابشان
 * می‌کند (قاعده‌ی سخت ۱ قراردادها).
 *
 * فهرست سکوها (`getListedPlatforms`) همان داده‌ای است که گردآورنده نوشته:
 * از قبل فیلترشده. گلدیکا ممکن است در استور باشد ولی هرگز در فهرست نیست.
 *
 * ⚠️ طرح این صفحه در ۲۰۲۶-۰۸-۱۱ عوض شد (`docs/design-spec.md`): جدول مقایسه،
 * چیپ‌ها و نمودار خطی حذف شدند و جایشان محور قیمت، کارت‌های منبع و خلاصه
 * بازار آمد. تست‌های ستون‌ها/سرستون‌ها/نشان «ارزان‌ترین» با خودِ جدول رفتند —
 * ولی هر ثابتی که به طراحی وابسته نبود اینجا مانده و روی رابط تازه دوباره
 * بسته شده: قیمت در HTML سروری، کهنگی نه خطا، فیلتر فهرست، و نوار ماده ۵.
 *
 * نشان‌های «خرید بسته»/«فروش بسته»/«دفتر سفارش» و ستون‌های کارمزد به صفحه‌ی
 * سکو و صفحه‌ی دارایی منتقل شدند و تست‌هایشان در
 * `tests/asset-platform-pages.test.tsx` است (بند ۱۵، تصمیم ۵ و ۶).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import { REGISTRY_PLATFORMS } from "../src/lib/registry";
import { THEME_ATTRIBUTE, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../src/lib/theme";
import {
  freshIso,
  healthyStore,
  homeData,
  LISTED,
  makeSnapshot,
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

/** نشانگر یک سکو روی محور، با همه‌ی فرزندانش. */
function markerOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<a[^>]*data-rail-marker="${slug}"[\\s\\S]*?</a>`));
  if (match === null) throw new Error(`نشانگر ${slug} در HTML نیست`);
  return match[0];
}

/** کارت یک سکو. */
function cardOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<a[^>]*data-source-card="${slug}"[\\s\\S]*?</a>`));
  if (match === null) throw new Error(`کارت ${slug} در HTML نیست`);
  return match[0];
}

/** درصد `right` یک نشانگر — موقعیتش روی محور. */
function railPercentOf(html: string, slug: string): number {
  const style = markerOf(html, slug).match(/right:\s*([\d.]+)%/);
  if (style === null) throw new Error(`نشانگر ${slug} موقعیت ندارد`);
  return Number(style[1]);
}

describe("صفحه‌ی اصلی — قیمت‌ها در HTML سروری (بند ۱۴)", () => {
  /**
   * ⚠️ معیار پذیرش صریح بند ۱۴: «با جاوااسکریپت غیرفعال قیمت‌ها دیده شوند».
   * `renderToStaticMarkup` دقیقاً همان چیزی را می‌دهد که مرورگرِ بی‌جاوااسکریپت
   * می‌بیند — هیچ افکتی اجرا نشده.
   */
  it("قیمت هر منبع با ارقام فارسی در همان HTML اولیه است", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("۱۸٬۶۱۱٬۰۰۰"); // وال‌گلد
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰"); // طلاسی
    expect(html).toContain("۱۸٬۵۳۸٬۰۰۰"); // میلی
  });

  it("موقعیت هر نشانگر در همان صفت style سروری است، نه بعد از hydration", async () => {
    const html = await renderHome(healthyStore());
    expect(railPercentOf(html, "wallgold")).toBeGreaterThan(0);
    expect(railPercentOf(html, "milli")).toBeGreaterThan(0);
  });

  it("مسیر اسپارک‌لاین سمت سرور تولید شده و در HTML است", async () => {
    const html = await renderHome(healthyStore(), {
      history: [
        {
          platform_slug: "milli",
          points: [0, 1, 2, 3].map((index) => ({
            hour: new Date(Date.UTC(2026, 7, 11, index)).toISOString(),
            value: 18_500_000 + index * 1000,
          })),
          latest: 18_503_000,
          side_used: "PRICE",
        },
      ],
    });
    expect(cardOf(html, "milli")).toMatch(/<path[^>]*d="M[\d.]+,[\d.]+C/);
  });

  it("هیچ کتابخانه‌ی نموداری در خروجی نیست — SVG دستی است", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("recharts");
  });
});

describe("صفحه‌ی اصلی — محور قیمت (بند ۵)", () => {
  /**
   * ⚠️ بند ۱.۴: «راست = ارزان‌تر». مقدار `right` فاصله از لبه‌ی راست است،
   * پس ارزان‌ترین باید **کم‌ترین** درصد را داشته باشد. نسخه‌ی اول فرمول سند
   * را عیناً پیاده کرد و ارزان‌ترین چپ‌ترین افتاد — خلاف زیرعنوان خودِ کارت.
   */
  it("ارزان‌ترین راست‌ترین است (بند ۱.۴: راست = ارزان‌تر)", async () => {
    const html = await renderHome(healthyStore());
    // طلاسی ۱۸٬۵۳۰٬۰۰۰ < میلی ۱۸٬۵۳۸٬۰۰۰ < وال‌گلد ۱۸٬۶۱۱٬۰۰۰
    expect(railPercentOf(html, "talasea")).toBeLessThan(railPercentOf(html, "milli"));
    expect(railPercentOf(html, "milli")).toBeLessThan(railPercentOf(html, "wallgold"));
  });

  it("لنگر «قیمت مرجع» روی موقعیت سکوی مرجع می‌نشیند", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("قیمت مرجع");
    const anchor = html.match(/data-rail-anchor[^>]*style="right:\s*([\d.]+)%/);
    expect(anchor).not.toBeNull();
    expect(Number(anchor?.[1])).toBe(railPercentOf(html, "milli"));
  });

  it("پاورقی محور کمینه، بیشینه و بازه‌ی اختلاف را می‌دهد", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("گران‌تر · ۱۸٬۶۱۱٬۰۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰ · ارزان‌تر");
    expect(html).toContain("بازه اختلاف ۸۱٬۰۰۰ تومان");
  });

  /**
   * ⚠️ نگهبان بند ۵، «مورد لبه‌ای که حتماً باید حل شود». بدون کف ۵۰٬۰۰۰،
   * این دو سکو که ۲٬۰۰۰ تومان فاصله دارند دو سرِ محور را می‌گرفتند.
   */
  it("با اختلاف ناچیز، نشانگرها حول مرکز جمع می‌مانند", async () => {
    const store = healthyStore();
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      mid: 18_531_000,
      fetchedAt: freshIso(),
    });
    store.snapshots["milli"] = makeSnapshot({
      slug: "milli",
      mid: 18_529_000,
      fetchedAt: freshIso(),
    });
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      mid: 18_530_000,
      fetchedAt: freshIso(),
    });
    const html = await renderHome(store);
    for (const slug of ["wallgold", "milli", "talasea"]) {
      expect(railPercentOf(html, slug), slug).toBeGreaterThan(40);
      expect(railPercentOf(html, slug), slug).toBeLessThan(60);
    }
  });

  it("هر نشانگر برچسب دسترس‌پذیری با نام و قیمت دارد (بند ۱۲)", async () => {
    const html = await renderHome(healthyStore());
    expect(markerOf(html, "wallgold")).toContain('aria-label="وال‌گلد — ۱۸٬۶۱۱٬۰۰۰ تومان"');
  });
});

describe("صفحه‌ی اصلی — کارت‌های منبع (بند ۶)", () => {
  it("فقط کارت سکوی مرجع بج «قیمت مرجع» می‌گیرد", async () => {
    const html = await renderHome(healthyStore());
    expect(cardOf(html, "milli")).toContain("قیمت مرجع");
    expect(cardOf(html, "wallgold")).not.toContain("قیمت مرجع");
  });

  /**
   * ⚠️ نگهبان بند ۱۵، تصمیم ۳: درصد اختلاف نسبت به مرجع حذف شد و نه محاسبه
   * می‌شود نه نمایش داده. اگر روزی برگردد، این تست باید قرمز شود.
   */
  it("هیچ بج درصد اختلافی روی کارت‌ها نیست", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toMatch(/[−+][۰-۹٫]+٪/);
  });
});

describe("صفحه‌ی اصلی — خلاصه بازار (بند ۷)", () => {
  it("عدد درشت نام سکوی مرجع را کنار خودش دارد (قاعده‌ی سخت ۴)", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("قیمت مرجع · میلی · تومان");
  });

  /** ⚠️ خط قرمز حقوقی بند ۷.۱ سند معماری. */
  it("کلمه‌ی «میانگین» هیچ‌جای صفحه نیست", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("میانگین");
  });

  it("هر سه زبانه‌ی بازه در HTML سروری‌اند تا تعویضشان فچ نزند", async () => {
    const html = await renderHome(healthyStore());
    for (const key of ["DAILY", "WEEKLY", "MONTHLY"]) {
      expect(html, key).toContain(`data-summary-tab="${key}"`);
    }
  });
});

describe("صفحه‌ی اصلی — جدول حذف شد (بند ۱.۱)", () => {
  it("هیچ جدول قیمتی در صفحه نیست", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("<table");
  });

  /**
   * حذف جدول یعنی ۷ تا ۱۱ سکو لینک داخلی درجه‌یکشان را از دست می‌دادند.
   * فهرست پاصفحه جبرانش می‌کند (تصمیم مالک ۲۰۲۶-۰۸-۱۱).
   */
  it("همه‌ی سکوهای فهرست از پاصفحه لینک داخلی می‌گیرند", async () => {
    const html = await renderHome(healthyStore());
    for (const platform of LISTED) {
      expect(html, platform.slug).toContain(`data-all-platform="${platform.slug}"`);
    }
  });

  /**
   * قطع ردیس ⟸ فهرست از رجیستری ثابت می‌آید (`lib/catalog.ts`)، پس حتی در
   * قطع کامل هم هیچ صفحه‌ی سکویی لینک ورودی‌اش را از دست نمی‌دهد.
   */
  it("در قطع کامل هم فهرست پاصفحه از رجیستری پر می‌شود", async () => {
    const html = await renderHome({ listed: [], snapshots: {}, updatedAt: {} });
    for (const platform of REGISTRY_PLATFORMS) {
      expect(html, platform.slug).toContain(`data-all-platform="${platform.slug}"`);
    }
  });

  it("فهرست پاصفحه قیمت و کارمزد ندارد — جدول دوم نیست", async () => {
    const html = await renderHome(healthyStore());
    const footer = html.match(/<nav[^>]*all-platforms-heading[\s\S]*?<\/nav>/);
    expect(footer).not.toBeNull();
    expect(footer?.[0]).not.toMatch(/[۰-۹]٬[۰-۹]/);
  });

  it("گلدیکا در استور هست ولی هرگز رندر نمی‌شود (PERMISSION_PENDING)", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("گلدیکا");
    expect(html).not.toContain("goldika");
  });
});

describe("صفحه‌ی اصلی — کارت‌های غیرفعال (بند ۸)", () => {
  /**
   * حباب‌سنج داده ندارد (`docs/api-gaps.md` بند ۳): ورودی فرمولش انس و دلار
   * است و هیچ‌کدام در گردآورنده نیستند. کارت می‌آید ولی هیچ عددی جعل نمی‌کند.
   */
  it("حباب‌سنج رندر می‌شود ولی هیچ عددی ادعا نمی‌کند", async () => {
    const html = await renderHome(healthyStore());
    const card = html.match(/<section[^>]*data-card="bubble"[\s\S]*?<\/section>/);
    expect(card).not.toBeNull();
    expect(card?.[0]).toContain("حباب سنج");
    expect(card?.[0]).toContain("به زودی فعال می‌شود");
    expect(card?.[0]).not.toMatch(/[۰-۹]٬[۰-۹]/);
  });

  it("کارت هشدار قیمت هم غیرفعال است", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("هشدار قیمت");
  });

  it("پوسته‌ی ماشین‌حساب سروررندر است (بند ۱۴)", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("ماشین حساب طلای زینتی");
    expect(html).toContain("اجرت ساخت (٪)");
  });
});

describe("صفحه‌ی اصلی — قطع منبع ⟸ کهنگی، نه خطا (قاعده‌ی سخت ۵)", () => {
  it("با مردن یک منبع صفحه رندر می‌شود و بقیه سر جایشان می‌مانند", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();

    const html = await renderHome(store);
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("میلی");
    expect(cardOf(html, "talasea")).toContain("قیمت در دسترس نیست");
  });

  it("سکوی بی‌قیمت نشانگر محور نمی‌گیرد ولی کارتش می‌ماند", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    const html = await renderHome(store);
    expect(html).not.toContain('data-rail-marker="talasea"');
    expect(() => cardOf(html, "talasea")).not.toThrow();
  });

  it("قطع کامل هر سه منبع ⟸ صفحه باز هم رندر می‌شود", async () => {
    const html = await renderHome({ listed: [], snapshots: {}, updatedAt: {} });
    expect(html).toContain("محور قیمت طلای ۱۸ عیار");
    expect(html).toContain("قیمت در دسترس نیست");
  });

  /** بند ۱۱: با کم‌تر از دو منبعِ قیمت‌دار، محور معنا ندارد. */
  it("با یک منبع قیمت‌دار محور رسم نمی‌شود ولی صفحه سالم است", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.snapshots["wallgold"] = null;
    store.snapshots["melligold"] = null;
    store.snapshots["tlyn"] = null;
    const html = await renderHome(store);
    expect(html).toContain("برای رسم محور دست‌کم دو سکوی قیمت‌دار لازم است");
  });

  it("سکوی کارمزدنامعلوم عدد خودش را دارد و جدا نمی‌افتد", async () => {
    const html = await renderHome(storeWithUnknownFee());
    expect(html).toContain("ملی‌گلد");
  });

  /**
   * ⚠️ الزام بند ۶.۲ سند معماری: سن داده باید در خودِ HTML سروری باشد. پیش
   * از بازطراحی، هر ردیف جدول برچسب خودش را داشت؛ حالا یک برچسب سطح-صفحه
   * روی محور است. حذف جدول نباید این را با خودش می‌برد.
   */
  it("برچسب «آخرین به‌روزرسانی» با <time datetime> در خود HTML است", async () => {
    const store = healthyStore();
    const html = await renderHome(store);
    const latest = Object.values(store.updatedAt)
      .filter((iso): iso is string => iso !== null)
      .sort()
      .at(-1) as string;
    expect(html).toContain("آخرین به‌روزرسانی");
    expect(html).toMatch(timeTagPattern(latest));
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

describe("پوسته‌ی ریشه — فارسی، راست‌به‌چپ، و تم بدون فلش", () => {
  /**
   * ⚠️ نگهبان سطح کد، نه رندر. `RootShell` از `HeadContent`/`Scripts` استفاده
   * می‌کند و بدون `RouterProvider` رندر نمی‌شود (تجربی سنجیده شد: «useRouter
   * must be used inside a RouterProvider»). رندر واقعیِ ‎<html lang="fa"
   * dir="rtl">‎ با سرور بیلدشده راستی‌آزمایی شد؛ این نگهبان جلوی حذف
   * بی‌سروصدای همان صفت‌ها را در بازنویسی بعدی می‌گیرد.
   *
   * ⚠️ الگو عمداً به ترتیب یا فاصله‌ی صفت‌ها حساس نیست: نسخه‌ی قبلی
   * ‎/<html\s+lang="fa"\s+dir="rtl">/‎ بود و به‌محض اینکه صفت سوم اضافه شد و
   * پرتیه‌کننده تگ را چندخطی کرد، شکست — بی‌آنکه چیزی واقعاً خراب شده باشد.
   */
  function rootSource(): string {
    return readFileSync(join(__dirname, "..", "src/routes/__root.tsx"), "utf8");
  }

  /**
   * ⚠️ `<html\s` و نه `<html\b`: خودِ کامنت‌های همین فایل رشته‌ی «‎<html>‎» را
   * دارند و الگوی آزادتر اول به آن‌ها می‌خورد و تست را با پیام گمراه‌کننده
   * قرمز می‌کند. داشتن دست‌کم یک صفت، تگ واقعی JSX را از متن کامنت جدا می‌کند.
   */
  function htmlTag(): string {
    const match = rootSource().match(/<html\s[^>]*>/);
    if (match === null) throw new Error("تگ <html> صفت‌دار در پوسته‌ی ریشه نیست");
    return match[0];
  }

  it("پوسته‌ی ریشه lang=fa و dir=rtl دارد", () => {
    expect(htmlTag()).toMatch(/lang="fa"/);
    expect(htmlTag()).toMatch(/dir="rtl"/);
  });

  /**
   * بند ۱۴ سند طراحی، مورد ۳. سرور همیشه یک تم ثابت می‌دهد و اسکریپت inline
   * پیش از نقاشی اصلاحش می‌کند؛ بدون `suppressHydrationWarning` همان اصلاح
   * به‌صورت خطای hydration گزارش می‌شود.
   */
  it("تم را سروری و ثابت می‌نویسد و هشدار hydration را روی همان عنصر خاموش می‌کند", () => {
    expect(htmlTag()).toMatch(/data-theme=\{SERVER_THEME\}/);
    expect(htmlTag()).toMatch(/suppressHydrationWarning/);
  });

  /**
   * ⚠️ جای اسکریپت تعیین‌کننده است، نه صرفاً وجودش: باید **داخل `<head>`**
   * باشد تا مرورگر همگام اجرایش کند و صفت پیش از اولین پیکسل بنشیند. اگر
   * روزی به انتهای `<body>` منتقل شود، فلش سفید برمی‌گردد و هیچ تست دیگری
   * نمی‌گیردش.
   */
  it("اسکریپت تشخیص تم درون <head> است، نه در بدنه", () => {
    const head = rootSource().match(/<head>[\s\S]*?<\/head>/);
    expect(head, "بلوک <head> در پوسته‌ی ریشه نیست").not.toBeNull();
    expect(head?.[0]).toContain("THEME_INIT_SCRIPT");
  });

  /**
   * نام صفت و کلید ذخیره در دو جا استفاده می‌شوند — اسکریپت inline و دکمه‌ی
   * تعویض. اگر از هم واگرا شوند، دکمه کار می‌کند ولی انتخاب کاربر در
   * بارگذاری بعدی خوانده نمی‌شود؛ نقصی که فقط با ریفرش دیده می‌شود.
   */
  it("اسکریپت inline همان صفت و کلیدی را می‌نویسد که lib/theme می‌خواند", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_ATTRIBUTE));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
  });

  /** سلکتور دارک در CSS باید همان صفتی باشد که اسکریپت می‌نشاند. */
  it("سلکتور دارک در styles.css با همان صفت بسته شده", () => {
    const css = readFileSync(join(__dirname, "..", "src/styles.css"), "utf8");
    expect(css).toContain(`[${THEME_ATTRIBUTE}="dark"]`);
    expect(css).toMatch(/@custom-variant\s+dark\s+\(&:is\(\[data-theme="dark"\]\s+\*\)\)/);
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

describe("صفحه‌ی اصلی — کهنگی هر سکو روی کارت خودش (قاعده‌ی سخت ۵)", () => {
  /**
   * ⚠️ برچسب سطح-صفحه کافی نیست: بیشینه‌ی زمان همه‌ی سکوهاست، پس یک سکوی
   * مرده پشت تازگیِ بقیه پنهان می‌ماند. جدول قدیمی این را به‌ازای هر ردیف
   * داشت؛ با حذفش گم شد و بازبینی کد گرفتش.
   */
  it("هر کارت منبع برچسب زمان خودش را در HTML سروری دارد", async () => {
    const html = await renderHome(healthyStore());
    for (const slug of ["wallgold", "talasea", "milli"]) {
      expect(cardOf(html, slug), slug).toMatch(/<time[^>]*data-live="updated-at"/);
    }
  });

  it("سکوی کهنه روی کارت خودش «کهنه» می‌گیرد، حتی وقتی بقیه تازه‌اند", async () => {
    const store = healthyStore();
    store.updatedAt["talasea"] = staleIso();
    const html = await renderHome(store);
    expect(cardOf(html, "talasea")).toContain("کهنه");
    expect(cardOf(html, "wallgold")).not.toContain("کهنه");
  });

  it("سکوی بی‌سابقه دروغ نمی‌گوید", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = null;
    const html = await renderHome(store);
    expect(cardOf(html, "talasea")).toContain("هنوز داده‌ای ثبت نشده است");
  });
});
