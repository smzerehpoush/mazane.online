import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { HomePage } from "../src/components/tablo/HomePage";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import {
  freshIso,
  homeData,
  makeListing,
  makeSnapshot,
  seed,
  slugPageData,
  type SeededStore,
} from "./support/seed";

const NON_REVENUE_REFERENCE_HOSTS: ReadonlySet<string> = new Set(["tala.ir", "www.tala.ir"]);

function attrOf(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : (match[1] ?? null);
}

function relTokens(tag: string): Set<string> {
  return new Set((attrOf(tag, "rel") ?? "").split(/\s+/).filter(Boolean));
}

function assertOutboundLinkPolicy(
  html: string,
  platformHosts: ReadonlySet<string>,
  pageName: string,
): number {
  let goLinks = 0;
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attrOf(tag, "href");
    if (href === null) continue;
    if (/^https?:\/\//.test(href)) {
      const host = new URL(href).hostname;
      if (platformHosts.has(host)) {
        throw new Error(
          `بند ۶.۴ نقض شد: لینک درآمدزای ${href} در «${pageName}» /go/ را دور می‌زند`,
        );
      }
      const rel = relTokens(tag);
      if (!rel.has("nofollow") || !rel.has("noopener")) {
        throw new Error(
          `بند ۶.۴ نقض شد: لینک خروجی ${href} در «${pageName}» rel کامل ندارد (${tag})`,
        );
      }
      if (!NON_REVENUE_REFERENCE_HOSTS.has(host) && !rel.has("sponsored")) {
        throw new Error(
          `بند ۶.۴ نقض شد: لینک خروجی ${href} در «${pageName}» sponsored ندارد (${tag})`,
        );
      }
    } else if (href.startsWith("/go/")) {
      goLinks += 1;
      const rel = relTokens(tag);
      for (const token of ["sponsored", "nofollow", "noopener"]) {
        if (!rel.has(token)) {
          throw new Error(
            `بند ۶.۴ نقض شد: لینک ${href} در «${pageName}» توکن ${token} را در rel ندارد (${tag})`,
          );
        }
      }
      if (attrOf(tag, "target") !== "_blank") {
        throw new Error(`لینک ${href} در «${pageName}» باید target="_blank" داشته باشد (${tag})`);
      }
    }
  }
  return goLinks;
}

const REFERRAL_CODE = "MZN-OWNER-CODE";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    website_url: "https://wallgold.ir",
    referral_url: null,
    referral_param: null,
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    website_url: "https://talasea.ir",
    referral_url: null,
    referral_param: "r",
  },
  {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    website_url: "https://milli.gold",
    referral_url: `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    referral_param: "referralCode",
  },
];

const PLATFORM_HOSTS: ReadonlySet<string> = new Set(
  PLATFORMS.flatMap((platform) =>
    [platform.website_url, platform.referral_url]
      .filter((url): url is string => typeof url === "string")
      .map((url) => new URL(url).hostname),
  ),
);

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold", "talasea", "milli"],
  published: true,
  purity: "750",
});

function seededStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18],
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
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now },
  };
}

async function renderSlug(slug: string): Promise<string> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
  return renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
}

describe("هیچ لینک خروجی درآمدزایی بدون sponsored یا بیرون /go/ نیست", () => {
  it("صفحه‌ی اصلی از کاونده می‌گذرد و برای هر سکو یک لینک /go/ دارد", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(seededStore())} />);
    const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی اصلی");
    // ⚠️ شمار دقیق دیگر ادعا نمی‌شود: با بازطراحی، هر منبع **دو** نقطه‌ی
    // خروج دارد (نشانگر محور و کارت منبع) و منبعِ بی‌قیمت فقط کارت می‌گیرد.
    // چیزی که واقعاً مهم است این است که هر سکو دست‌کم یک راه خروج داشته
    // باشد و **همه‌ی** لینک‌ها از کاونده‌ی سیاست رد شوند.
    expect(goLinks).toBeGreaterThanOrEqual(PLATFORMS.length);
    for (const platform of PLATFORMS) {
      expect(html, platform.slug).toContain(`href="/go/${platform.slug}"`);
    }
    expect(html).not.toContain(REFERRAL_CODE);
  });

  it("صفحه‌ی هر سکو از کاونده می‌گذرد و لینک وب‌سایتش /go/ است", async () => {
    for (const platform of PLATFORMS) {
      seed(seededStore());
      const html = await renderSlug(platform.slug);
      const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, `صفحه‌ی ${platform.slug}`);
      expect(goLinks).toBeGreaterThanOrEqual(1);
      expect(html).toContain(`href="/go/${platform.slug}"`);
      expect(html).not.toContain(REFERRAL_CODE);
    }
  });

  it("صفحه‌ی دارایی از کاونده می‌گذرد", async () => {
    seed(seededStore());
    const html = await renderSlug("tala-18");
    assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی دارایی");
    expect(html).not.toContain(REFERRAL_CODE);
  });

  it("فیلدهای معرف اصلاً وارد payload کلاینت نمی‌شوند (نه فقط نمایش)", async () => {
    const data = await homeData(seededStore());
    for (const row of data.rows) {
      expect(row.platform).not.toHaveProperty("referral_url");
      expect(row.platform).not.toHaveProperty("referral_param");
    }
    seed(seededStore());
    const platformPage = await slugPageData("milli");
    expect(platformPage?.kind).toBe("platform");
    if (platformPage?.kind === "platform") {
      expect(platformPage.platform).not.toHaveProperty("referral_url");
      expect(platformPage.hasOutbound).toBe(true);
    }
    expect(JSON.stringify(data)).not.toContain(REFERRAL_CODE);
  });
});

describe("کاونده‌ی سیاست لینک — نقض‌ها واقعاً شکست می‌خورند", () => {
  it("لینک مستقیم به میزبان سکو (دور زدن /go/) ⟸ شکست", () => {
    const bad = '<a href="https://wallgold.ir" rel="sponsored nofollow noopener">و</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(/دور می‌زند/);
  });

  it("لینک خروجی بدون sponsored ⟸ شکست", () => {
    const bad = '<a href="https://tabligh.example" rel="nofollow noopener">آ</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(/sponsored/);
  });

  it("لینک /go/ بدون rel کامل یا بدون target=_blank ⟸ شکست", () => {
    const noRel = '<a href="/go/milli" rel="nofollow noopener" target="_blank">م</a>';
    expect(() => assertOutboundLinkPolicy(noRel, PLATFORM_HOSTS, "آزمایشی")).toThrow(/sponsored/);
    const noTarget = '<a href="/go/milli" rel="sponsored nofollow noopener">م</a>';
    expect(() => assertOutboundLinkPolicy(noTarget, PLATFORM_HOSTS, "آزمایشی")).toThrow(/_blank/);
  });

  it("ارجاع غیر درآمدزا به مرجع قیمت: ساده ولی حتماً nofollow", () => {
    const ok = '<a href="https://www.tala.ir/price" rel="nofollow noopener">طلا</a>';
    expect(assertOutboundLinkPolicy(ok, PLATFORM_HOSTS, "آزمایشی")).toBe(0);
    const bare = '<a href="https://www.tala.ir/price">طلا</a>';
    expect(() => assertOutboundLinkPolicy(bare, PLATFORM_HOSTS, "آزمایشی")).toThrow(/rel کامل/);
  });
});

describe("مرتب‌سازی هیچ ورودی‌ای از فیلدهای معرف نمی‌گیرد", () => {
  it("سکوی گران‌ترِ دارای کد معرف با داشتن referral_url بالا نمی‌آید", async () => {
    const store = seededStore();
    const now = freshIso();
    store.snapshots["milli"] = makeSnapshot({
      slug: "milli",
      mid: 18800000,
      fetchedAt: now,
    });
    const html = renderToStaticMarkup(<HomePage data={await homeData(store)} />);

    // ⚠️ «ترتیب» در طرح تازه یعنی **موقعیت روی محور** (: راست =
    // ارزان‌تر، و `right` فاصله از لبه‌ی راست است). میلی کد معرف دارد و
    // اینجا گران‌ترین است — باید چپ‌ترین بنشیند، یعنی **بیشترین** درصد.
    // اگر روزی کمیسیون وارد هندسه شود، همین‌جا قرمز می‌شود.
    const percentOf = (slug: string): number => {
      const marker = html.match(
        new RegExp(`data-rail-marker="${slug}"[^>]*style="right:\\s*([\\d.]+)%`),
      );
      if (marker === null) throw new Error(`نشانگر ${slug} در HTML نیست`);
      return Number(marker[1]);
    };
    expect(percentOf("talasea")).toBeLessThan(percentOf("wallgold"));
    expect(percentOf("wallgold")).toBeLessThan(percentOf("milli"));
  });

  it("صفحه‌ی دارایی هم همین ترتیب را دارد — کد معرف در گروه‌بندی اثر ندارد", async () => {
    const store = seededStore();
    const now = freshIso();
    store.snapshots["milli"] = makeSnapshot({
      slug: "milli",
      mid: 18800000,
      fetchedAt: now,
    });
    seed(store);
    const html = await renderSlug("tala-18");
    expect(html.indexOf('data-platform="wallgold"')).toBeLessThan(
      html.indexOf('data-platform="milli"'),
    );
  });

  it("توابع مرتب‌سازی حتی نام فیلدهای معرف را نمی‌شناسند (نگهبان سطح کد)", () => {
    // «referral_url نباید هیچ ورودی‌ای به منطق مرتب‌سازی داشته
    // باشد.» این نگهبان وجودی است: اگر روزی کسی referral را وارد
    // tableView/bestView/groupRows یا لایه‌ی ردیف کند، همین‌جا قرمز می‌شود.
    // ⚠️ مسیرها با بازنویسی تنکستک به‌روز شدند؛ اگر فایلی جابه‌جا شد،
    // مسیر تازه‌اش را اینجا بگذارید — این فهرست حذف‌شدنی نیست.
    for (const file of [
      // ⚠️ با بازطراحی داشبورد، `ComparisonTable`/`home-view` جای خود را به
      // `lib/dashboard.ts` دادند — همان‌جا که حالا ترتیب و هندسه‌ی محور ساخته
      // می‌شود. مسیر عوض شد، پوشش نه. این فهرست حذف‌شدنی نیست.
      "src/lib/dashboard.ts",
      "src/components/tablo/PriceRail.tsx",
      "src/components/tablo/SourceCards.tsx",
      "src/components/content/AssetPage.tsx",
      "src/lib/rows.ts",
    ]) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source, `${file} نباید فیلد معرف بخواند`).not.toMatch(/referral/);
    }
  });
});
