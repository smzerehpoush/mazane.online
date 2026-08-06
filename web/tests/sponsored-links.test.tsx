/**
 * تست وجودی CI بند ۶.۴ — الزام غیرقابل‌مذاکره‌ی لینک‌های درآمدزا (بلیت ۹).
 *
 * «یک تست خودکار در CI بنویسید که اگر لینک خروجی بدون sponsored پیدا شد
 * شکست بخورد» — و دقیقاً از آن چیزهایی است که در بازنویسی‌ها بی‌سروصدا از
 * بین می‌رود. برای همین این تست لینک‌ها را **برنمی‌شمارد**: HTML رندرشده‌ی
 * صفحه‌ی اصلی، صفحات سکو، صفحه‌ی دارایی و جایگاه‌های تبلیغ را عمومی برای
 * الگوی ‎href="http‎ می‌کاود؛ هر لینک خروجی به میزبان یک سکو (دور زدن
 * ‎/go/‎) یا هر لینک خروجی بدون rel کامل، شکست است. لینک ارجاع غیر درآمدزا
 * به مراجع قیمت (tala.ir / bonbast — بند ۱۲.۲) تنها استثناست: ساده ولی
 * حتماً nofollow.
 *
 * همین‌جا قاعده‌ی مکمل بند ۶.۴ هم تست می‌شود: مرتب‌سازی هیچ ورودی‌ای از
 * فیلدهای معرف (referral_url / referral_param) نمی‌گیرد.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import SlugPage from "../app/[slug]/page";
import { AdSlot } from "../app/ad-slot";
import Home from "../app/page";
import type { InstrumentListing, ListedPlatform } from "../lib/prices";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  seed,
  type SeededStore,
} from "./support/seed";

/* ---------- کاونده‌ی عمومی سیاست لینک خروجی (بند ۶.۴) ---------- */

/**
 * میزبان‌های مراجع قیمت (بند ۱۲.۲) — ارجاع تحریری غیر درآمدزا؛ لینکشان
 * ساده می‌ماند ولی حداقل nofollow می‌خواهد. هیچ سکویی اینجا نمی‌آید.
 */
const NON_REVENUE_REFERENCE_HOSTS: ReadonlySet<string> = new Set([
  "tala.ir",
  "www.tala.ir",
  "bonbast.com",
  "www.bonbast.com",
]);

function attrOf(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : match[1];
}

function relTokens(tag: string): Set<string> {
  return new Set((attrOf(tag, "rel") ?? "").split(/\s+/).filter(Boolean));
}

/**
 * سیاست لینک خروجی روی HTML رندرشده — throw یعنی شکست CI:
 *  - ‎href="http…"‎ به میزبان یک سکو ⟸ ممنوع مطلق (باید از ‎/go/‎ بگذرد)؛
 *  - هر ‎href="http…"‎ دیگر ⟸ دست‌کم nofollow و noopener؛ و جز مراجع
 *    قیمت، sponsored هم الزامی است؛
 *  - هر ‎href="/go/…"‎ ⟸ ‎rel="sponsored nofollow noopener"‎ کامل +
 *    ‎target="_blank"‎.
 * خروجی: شمار لینک‌های ‎/go/‎ تا فراخوان بتواند «اصلاً لینکی بود؟» را هم
 * بسنجد (تست وجودی که هیچ‌چیز نکاود، تست نیست).
 */
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
        throw new Error(
          `لینک ${href} در «${pageName}» باید target="_blank" داشته باشد (${tag})`,
        );
      }
    }
  }
  return goLinks;
}

/* ---------- داده‌ی seed — همان شکل JSON کانونی گردآورنده ---------- */

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
  // تنها سکوی با کد معرفِ رسیده — مقصد /go/ خودش referral_url می‌شود.
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
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        buy: 18630690,
        sell: 18445310,
        reference: 18538000,
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now },
  };
}

function pageProps(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

/* ---------- تست وجودی بند ۶.۴ ---------- */

describe("بند ۶.۴ — هیچ لینک خروجی درآمدزایی بدون sponsored یا بیرون /go/ نیست", () => {
  it("صفحه‌ی اصلی (با جایگاه‌های تبلیغ) از کاونده می‌گذرد و دست‌کم یک لینک /go/ دارد", async () => {
    seed(seededStore());
    const html = renderToStaticMarkup(await Home());
    const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی اصلی");
    // پیشنهاد سردبیر در دو جایگاه تبلیغ — لینک درآمدزا و فقط از /go/.
    expect(goLinks).toBeGreaterThanOrEqual(2);
  });

  it("صفحه‌ی هر سکو از کاونده می‌گذرد و لینک وب‌سایتش /go/ است", async () => {
    for (const platform of PLATFORMS) {
      seed(seededStore());
      const html = renderToStaticMarkup(await SlugPage(pageProps(platform.slug)));
      const goLinks = assertOutboundLinkPolicy(
        html,
        PLATFORM_HOSTS,
        `صفحه‌ی ${platform.slug}`,
      );
      expect(goLinks).toBeGreaterThanOrEqual(1);
      expect(html).toContain(`href="/go/${platform.slug}"`);
      // کد معرف هرگز در HTML عمومی نمی‌نشیند — فقط سمت ریدایرکت است.
      expect(html).not.toContain(REFERRAL_CODE);
    }
  });

  it("صفحه‌ی دارایی از کاونده می‌گذرد", async () => {
    seed(seededStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی دارایی");
  });

  it("جایگاه تبلیغ به‌تنهایی: پیشنهاد سردبیر فقط از /go/ با rel کامل", () => {
    const html = renderToStaticMarkup(
      <AdSlot
        position="top"
        pick={{ slug: "milli", name_fa: "میلی", round_trip_percent: "0.9950" }}
      />,
    );
    const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "جایگاه تبلیغ");
    expect(goLinks).toBe(1);
    expect(html).toContain('href="/go/milli"');
  });
});

/* ---------- خود کاونده باید نقض را قرمز کند (وگرنه تست وجودی نیست) ---------- */

describe("کاونده‌ی سیاست لینک — نقض‌ها واقعاً شکست می‌خورند", () => {
  it("لینک مستقیم به میزبان سکو (دور زدن /go/) ⟸ شکست", () => {
    const bad = '<a href="https://wallgold.ir" rel="sponsored nofollow noopener">و</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(
      /دور می‌زند/,
    );
  });

  it("لینک خروجی بدون sponsored ⟸ شکست", () => {
    const bad = '<a href="https://tabligh.example" rel="nofollow noopener">آ</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(
      /sponsored/,
    );
  });

  it("لینک /go/ بدون rel کامل یا بدون target=_blank ⟸ شکست", () => {
    const noRel = '<a href="/go/milli" rel="nofollow noopener" target="_blank">م</a>';
    expect(() => assertOutboundLinkPolicy(noRel, PLATFORM_HOSTS, "آزمایشی")).toThrow(
      /sponsored/,
    );
    const noTarget = '<a href="/go/milli" rel="sponsored nofollow noopener">م</a>';
    expect(() => assertOutboundLinkPolicy(noTarget, PLATFORM_HOSTS, "آزمایشی")).toThrow(
      /_blank/,
    );
  });

  it("ارجاع غیر درآمدزا به مرجع قیمت: ساده ولی حتماً nofollow", () => {
    const ok = '<a href="https://www.tala.ir/price" rel="nofollow noopener">طلا</a>';
    expect(assertOutboundLinkPolicy(ok, PLATFORM_HOSTS, "آزمایشی")).toBe(0);
    const bare = '<a href="https://www.tala.ir/price">طلا</a>';
    expect(() => assertOutboundLinkPolicy(bare, PLATFORM_HOSTS, "آزمایشی")).toThrow(
      /rel کامل/,
    );
  });
});

/* ---------- قاعده‌ی مکمل بند ۶.۴: کمیسیون هیچ ورودی‌ای به ترتیب ندارد ---------- */

describe("مرتب‌سازی هیچ ورودی‌ای از فیلدهای معرف نمی‌گیرد (بند ۶.۴)", () => {
  it("سکوی گران‌ترِ دارای کد معرف با داشتن referral_url بالا نمی‌آید", async () => {
    const store = seededStore();
    const now = freshIso();
    // میلی (تنها سکوی referral_url دار) را گران‌ترین کن — باید آخر بماند.
    store.snapshots.milli = makeSnapshot({
      slug: "milli",
      mid: 18800000,
      buy: 18894000,
      sell: 18706000,
      reference: 18800000,
      fetchedAt: now,
    });
    seed(store);
    const html = renderToStaticMarkup(await Home());
    // ترتیب فقط از مؤثر خرید: وال‌گلد < طلاسی < میلی (با وجود کد معرفش).
    expect(html.indexOf('data-platform="wallgold"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="milli"'),
    );
    expect(html).not.toContain('data-cheapest="true" data-platform="milli"');
  });

  it("پیشنهاد سردبیر هم فقط از رفت‌وبرگشت گردآورنده می‌آید، نه از کد معرف", async () => {
    const store = seededStore();
    const now = freshIso();
    // وال‌گلد (بدون کد معرف) رفت‌وبرگشت بهتر — باید همان انتخاب شود.
    store.snapshots.wallgold = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      buy: 18704055,
      sell: 18517945,
      reference: 18611000,
      fetchedAt: now,
    });
    store.snapshots.wallgold.terms.round_trip_percent = "0.5000";
    seed(store);
    const html = renderToStaticMarkup(await Home());
    const slot = html.match(/<aside[^>]*data-ad-slot="top"[\s\S]*?<\/aside>/);
    expect(slot?.[0]).toContain('href="/go/wallgold"');
    expect(slot?.[0]).not.toContain('href="/go/milli"');
  });

  it("توابع مرتب‌سازی حتی نام فیلدهای معرف را نمی‌شناسند (نگهبان سطح کد)", () => {
    // بند ۶.۴: «referral_url نباید هیچ ورودی‌ای به منطق مرتب‌سازی داشته
    // باشد.» این نگهبان وجودی است: اگر روزی کسی referral را وارد
    // groupRows/editorialPick یا لایه‌ی ردیف کند، همین‌جا قرمز می‌شود.
    for (const file of ["app/page.tsx", "app/[slug]/asset-page.tsx", "lib/rows.ts"]) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source, `${file} نباید فیلد معرف بخواند`).not.toMatch(/referral/);
    }
  });
});
