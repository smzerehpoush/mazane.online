/**
 * نگهبان همگامی رجیستری ایستای وب با رجیستری کد گردآورنده.
 *
 * `src/lib/registry.ts` دستی نگهداری می‌شود و کارش این است که در قطعی ردیس
 * هویت صفحه‌ها را زنده نگه دارد. اگر از گردآورنده عقب بیفتد، بدترین حالت
 * ممکن پیش می‌آید: در **همان** قطعی‌ای که این رجیستری برایش ساخته شده،
 * سکوی تازه ۴۰۴ می‌شود یا سکوی حذف‌شده ۲۰۰ می‌گیرد. پس این تست فایل‌های
 * پایتون را می‌خواند و هر واگرایی را قرمز می‌کند.
 *
 * خواندن با `ast` کتابخانه‌ی استاندارد است (`tests/support/dump-collector-registry.py`)
 * — گردآورنده import نمی‌شود، پس نه pydantic لازم است نه هیچ سرویس زنده‌ای.
 *
 * چه چیزی سنجیده می‌شود:
 *   ۱. مجموعه و **ترتیب** سکوهای قابل نمایش (`is_listed` = ALLOWED) و همه‌ی
 *      فراداده‌ای که صفحه‌ی سکو رندر می‌کند.
 *   ۲. مجموعه، ترتیب و فراداده‌ی دارایی‌ها.
 *   ۳. `published` و `supporting_platform_slugs` — بازساخته از رجیستری
 *      آداپترها با همان آستانه‌ی گردآورنده، چون همین دو، ۲۰۰/۴۰۴ و عضویت
 *      سایت‌مپ را تعیین می‌کنند.
 *   ۴. کلمات رزرو و صفحات ایستا (آینه‌ی `lib/slugs.ts`).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "../src/lib/registry";
import { RESERVED_WORDS, STATIC_PAGE_SLUGS } from "../src/lib/slugs";

interface CollectorPlatform {
  slug: string;
  name_fa: string;
  data_policy: string;
  market_model: string;
  name_en: string | null;
  website_url: string | null;
  legal_entity: string | null;
  delivery_note_fa: string | null;
}

interface CollectorInstrument {
  slug: string;
  instrument: string;
  name_fa: string;
  unit_fa: string;
  purity: string | null;
  currency: string;
}

interface CollectorRegistry {
  platforms: CollectorPlatform[];
  instruments: CollectorInstrument[];
  adapters: Record<string, string[]>;
  publish_gate_min_platforms: number;
  reserved_words: string[];
  static_page_slugs: string[];
}

const SCRIPT = fileURLToPath(new URL("./support/dump-collector-registry.py", import.meta.url));
const COLLECTOR = fileURLToPath(new URL("../../collector/src/tablo_collector", import.meta.url));

/**
 * نبود `python3` را عمداً **پنهان نمی‌کنیم**: نگهبانی که در سکوت رد شود
 * نگهبان نیست. مخزن دوزبانه است و گردآورنده‌اش پایتون؛ python3 هست.
 */
function collectorRegistry(): CollectorRegistry {
  const stdout = execFileSync("python3", [SCRIPT, COLLECTOR], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as CollectorRegistry;
}

const registry = collectorRegistry();

/** فهرست عمومی = فقط ALLOWED (بند ۱۳، تصمیم ۲۰) — گلدیکا هرگز. */
const listed = registry.platforms.filter((p) => p.data_policy === "ALLOWED");

function asListedPlatform(platform: CollectorPlatform): ListedPlatform {
  return {
    slug: platform.slug,
    name_fa: platform.name_fa,
    data_policy: "ALLOWED",
    market_model: platform.market_model === "ORDER_BOOK" ? "ORDER_BOOK" : "OTC",
    name_en: platform.name_en,
    website_url: platform.website_url,
    legal_entity: platform.legal_entity,
    delivery_note_fa: platform.delivery_note_fa,
  };
}

/** بازسازی `build_listings` گردآورنده — همان آستانه، همان ترتیب. */
function asInstrumentListing(info: CollectorInstrument): InstrumentListing {
  const supporting = listed
    .filter((platform) => (registry.adapters[platform.slug] ?? []).includes(info.instrument))
    .map((platform) => platform.slug);
  return {
    slug: info.slug,
    instrument: info.instrument,
    name_fa: info.name_fa,
    unit_fa: info.unit_fa,
    purity: info.purity,
    currency: info.currency,
    supporting_platform_slugs: supporting,
    published: supporting.length >= registry.publish_gate_min_platforms,
  };
}

describe("رجیستری ایستای وب با رجیستری کد گردآورنده یکی است", () => {
  it("خودِ استخراج‌کننده واقعاً چیزی برداشته (وگرنه تست تهی سبز می‌شود)", () => {
    expect(registry.platforms.length).toBeGreaterThan(1);
    expect(registry.instruments.length).toBeGreaterThan(1);
    expect(Object.keys(registry.adapters).length).toBeGreaterThan(1);
  });

  it("سکوهای قابل نمایش: همان مجموعه، همان ترتیب، همان فراداده", () => {
    expect(REGISTRY_PLATFORMS).toEqual(listed.map(asListedPlatform));
  });

  it("گلدیکا (PERMISSION_PENDING) در فهرست عمومی وب نیست — تصمیم ۲۰", () => {
    const pending = registry.platforms
      .filter((p) => p.data_policy !== "ALLOWED")
      .map((p) => p.slug);
    expect(pending).toContain("goldika");
    for (const slug of pending) {
      expect(REGISTRY_PLATFORMS.map((p) => p.slug)).not.toContain(slug);
    }
  });

  it("دارایی‌ها: همان مجموعه و فراداده، با دروازه‌ی انتشار بازساخته", () => {
    expect(REGISTRY_INSTRUMENTS).toEqual(registry.instruments.map(asInstrumentListing));
  });

  it("کلمات رزرو و صفحات ایستا از گردآورنده عقب نمانده‌اند", () => {
    for (const word of registry.reserved_words) {
      expect(RESERVED_WORDS.has(word)).toBe(true);
    }
    // یک‌طرفه: وب می‌تواند صفحه‌ی ایستای بیشتری داشته باشد (مثلاً
    // ‎/mazane-chist‎ که هنوز در جدول اسلاگ گردآورنده ثبت نشده)، ولی هرگز
    // نباید صفحه‌ی ایستای گردآورنده را نداشته باشد.
    for (const slug of registry.static_page_slugs) {
      expect(STATIC_PAGE_SLUGS.has(slug)).toBe(true);
    }
  });
});
