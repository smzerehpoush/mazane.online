/**
 * مرز وب — رفتار در **قطعی منبع** (قاعده‌ی ۵ قراردادها: «قطع منبع ⟸ کهنگی،
 * نه خطا»).
 *
 * قطعی ردیس اینجا با همان چیزی مدل می‌شود که منبع واقعی در قطعی برمی‌گرداند:
 * `createRedisPriceSource` هر خطای اتصال را به «داده‌ای نیست» ترجمه می‌کند،
 * یعنی فهرست تهی و اسنپ‌شات `null`. پس فیک زیر دقیقاً همان است — هیچ
 * ردیس/شبکه‌ای لازم نیست.
 *
 * سه چیز سنجیده می‌شود، چون هر سه بازدارنده‌ی انتشار بودند:
 *   ۱. اسلاگ معتبرِ بی‌داده باید حل شود (۲۰۰ با حالت کهنگی)، نه ۴۰۴.
 *   ۲. اسلاگ ناشناخته باید همچنان ۴۰۴ بماند.
 *   ۳. سایت‌مپ باید کامل بماند، نه فقط صفحات ایستا.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  listPublishedPosts,
  listPublishedPostsStrict,
  setBlogSource,
  type BlogPost,
} from "../src/lib/blog";
import { listInstruments, listPlatforms } from "../src/lib/catalog";
import { getPlatformHistory } from "../src/lib/history";
import { assembleSlugPage } from "../src/lib/page-data";
import {
  getPlatformSnapshot,
  getUpdatedAt,
  resetPriceSource,
  setPriceSource,
} from "../src/lib/prices";
import { getReferencePrice } from "../src/lib/reference-price";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "../src/lib/registry";
import { fetchRowsForPlatforms } from "../src/lib/rows";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { resolveSlug } from "../src/lib/slugs";

/** آنچه منبع ردیس در قطعی برمی‌گرداند: همه‌چیز تهی، هیچ خطایی بالا نمی‌رود. */
function seedOutage(): void {
  setPriceSource({
    getListedPlatforms: async () => [],
    getSnapshot: async () => null,
    getUpdatedAt: async () => null,
    getInstruments: async () => [],
  });
}

const POST: BlogPost = {
  slug: "maliyat-tala-1405",
  title_fa: "مالیات طلا",
  body_md: "…",
  status: "published",
  published_at: "2026-08-01T09:00:00.000Z",
  updated_at: "2026-08-03T11:30:00.000Z",
};

async function slugPage(slug: string) {
  return assembleSlugPage(slug, {
    resolveSlug,
    fetchRowsForPlatforms,
    getPlatformSnapshot,
    getUpdatedAt,
    getInstruments: listInstruments,
    // این فایل هیچ setHistorySource/setReferencePriceSource ای صدا نمی‌زند —
    // دقیقاً همان قطعی که می‌سنجد: خواننده‌ی دامنه بی‌منبع، خودش کهنگی
    // برمی‌گرداند (فهرست/نوار خالی)، نه خطا.
    getPlatformHistory,
    getReferencePrice,
  });
}

beforeEach(() => {
  resetPriceSource();
  seedOutage();
  setBlogSource({
    listPosts: async () => [POST],
    getPost: async () => POST,
  });
});

describe("قطع ردیس: اسلاگ معتبر ۲۰۰ می‌ماند، ناشناخته ۴۰۴", () => {
  it("صفحه‌ی هر سکوی رجیستری حل می‌شود و نامش را دارد", async () => {
    for (const platform of REGISTRY_PLATFORMS) {
      const resolved = await resolveSlug(platform.slug);
      expect(resolved?.kind, platform.slug).toBe("platform");
    }
  });

  it("صفحه‌ی سکو payload کامل با اسنپ‌شات تهی می‌دهد — همان حالت کهنگی", async () => {
    const page = await slugPage("wallgold");
    expect(page?.kind).toBe("platform");
    if (page?.kind !== "platform") return;
    expect(page.platform.name_fa).toBe("وال‌گلد");
    // هیچ قیمتی نیست، ولی صفحه هست: نما «قیمت در دسترس نیست» رندر می‌کند.
    expect(page.snapshot).toBeNull();
    expect(page.updatedAt).toBeNull();
    // لینک درآمدزا هم زنده می‌ماند: مقصدش فراداده‌ی ثابت است، نه قیمت.
    expect(page.hasOutbound).toBe(true);
  });

  it("صفحه‌ی دارایی منتشرشده حل می‌شود و ردیف سکوهای پشتیبان را دارد", async () => {
    const page = await slugPage("tala-18");
    expect(page?.kind).toBe("instrument");
    if (page?.kind !== "instrument") return;
    expect(page.listing.name_fa).toBe("طلای ۱۸ عیار");
    // جدول خالی نمی‌شود: هر سکوی پشتیبان ردیف «قیمت در دسترس نیست» می‌گیرد.
    expect(page.rows.map((row) => row.platform.slug)).toEqual(
      page.listing.supporting_platform_slugs,
    );
    expect(page.rows.every((row) => row.snapshot === null)).toBe(true);
  });

  it("دارایی با دروازه‌ی بسته و اسلاگ ناشناخته همچنان ۴۰۴ اند", async () => {
    for (const listing of REGISTRY_INSTRUMENTS.filter((item) => !item.published)) {
      expect(await slugPage(listing.slug), listing.slug).toBeNull();
    }
    expect(await slugPage("no-such-thing")).toBeNull();
    expect(await slugPage("goldika")).toBeNull(); // PERMISSION_PENDING — تصمیم ۲۰
    expect(await slugPage("blog")).toBeNull(); // کلمه‌ی رزرو
  });
});

describe("قطع ردیس: سایت‌مپ کامل می‌ماند", () => {
  it("همه‌ی سکوها و دارایی‌های منتشرشده در سایت‌مپ هستند", async () => {
    const entries = buildSitemapEntries({
      posts: [{ ...POST, status: "published", published_at: POST.published_at! }],
      instruments: await listInstruments(),
      platforms: await listPlatforms(),
    });
    const paths = new Set(entries.map((entry) => entry.path));

    for (const platform of REGISTRY_PLATFORMS) {
      expect(paths.has(`/${platform.slug}`), platform.slug).toBe(true);
    }
    for (const listing of REGISTRY_INSTRUMENTS) {
      expect(paths.has(`/${listing.slug}`), listing.slug).toBe(listing.published);
    }
    expect(paths.has("/")).toBe(true);
    expect(paths.has(`/blog/${POST.slug}`)).toBe(true);
    // نگهبان عددی: سایت‌مپِ فقط-صفحات-ایستا (۴ نشانی) دوباره تکرار نشود.
    expect(entries.length).toBeGreaterThan(REGISTRY_PLATFORMS.length);
  });
});

describe("قطع پستگرس: سایت‌مپ ناقص منتشر نمی‌شود", () => {
  /**
   * صفحه‌ی HTML بلاگ می‌تواند با فهرست تهی ۲۰۰ بماند (بازدیدکننده متن صفحه
   * را می‌بیند)، ولی سایت‌مپ نمی‌تواند: یک ۲۰۰ که بی‌صدا همه‌ی ‎/blog/…‎ را
   * انداخته، به گوگل می‌گوید «این صفحه‌ها رفته‌اند» — و کش هم می‌شود. پس
   * مسیر سایت‌مپ از نسخه‌ی سخت‌گیر می‌خواند و در خطا ۵۰۳ با ‎no-store‎ می‌دهد
   * تا لبه با ‎stale-if-error‎ نسخه‌ی سالم قبلی را سرو کند (RFC 5861 دقیقاً
   * همین ۵xx را پوشش می‌دهد).
   */
  it("نسخه‌ی سخت‌گیر خطای استور را قورت نمی‌دهد، ولی نسخه‌ی معمولی می‌دهد", async () => {
    const boom = new Error("postgres down");
    setBlogSource({
      listPosts: async () => {
        throw boom;
      },
      getPost: async () => null,
    });
    await expect(listPublishedPostsStrict()).rejects.toThrow(boom);
    await expect(listPublishedPosts()).resolves.toEqual([]);
  });
});

describe("payload زنده همیشه مقدم بر رجیستری ایستاست", () => {
  it("سکوی تازه‌ی گردآورنده بدون دیپلوی وب دیده می‌شود", async () => {
    setPriceSource({
      getListedPlatforms: async () => [
        { slug: "sekoye-taze", name_fa: "سکوی تازه", data_policy: "ALLOWED" },
      ],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [],
    });
    expect((await resolveSlug("sekoye-taze"))?.kind).toBe("platform");
    // و فهرست ایستا جایگزینش نمی‌شود — زنده که هست، کف خوانده نمی‌شود.
    expect((await listPlatforms()).map((p) => p.slug)).toEqual(["sekoye-taze"]);
    expect(await resolveSlug("wallgold")).toBeNull();
  });

  it("دروازه‌ی انتشارِ تازه‌بازشده‌ی گردآورنده بر رجیستری ایستا مقدم است", async () => {
    setPriceSource({
      getListedPlatforms: async () => [],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [
        {
          slug: "noghre",
          instrument: "SILVER_990",
          name_fa: "نقره‌ی ۹۹۰",
          unit_fa: "گرم",
          purity: "990",
          currency: "TOMAN",
          supporting_platform_slugs: ["wallgold", "talasea"],
          published: true,
        },
      ],
    });
    // رجیستری ایستا published=false دارد؛ payload زنده بازش کرده.
    expect((await resolveSlug("noghre"))?.kind).toBe("instrument");
  });
});
