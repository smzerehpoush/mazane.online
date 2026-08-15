/**
 * ⚠️ This page's design changed on 2026-08-11: the comparison table, chips,
 * and line chart were removed, replaced by the price axis, source cards, and
 * market summary. The columns/headers/"cheapest" badge tests went with the
 * table itself — but every invariant that didn't depend on the design stayed
 * and was re-wired onto the new interface: prices in the server-rendered
 * HTML, staleness not error, listing filter, and the Article 5 banner.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import { railCountdownSeconds } from "../src/components/tablo/PriceRail";
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

function timeTagPattern(iso: string): RegExp {
  const escaped = iso.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<time [^>]*datetime="${escaped}"`, "i");
}

function markerOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<a[^>]*data-rail-marker="${slug}"[\\s\\S]*?</a>`));
  if (match === null) throw new Error(`marker ${slug} not in HTML`);
  return match[0];
}

function cardOf(html: string, slug: string): string {
  const match = html.match(new RegExp(`<a[^>]*data-source-card="${slug}"[\\s\\S]*?</a>`));
  if (match === null) throw new Error(`card ${slug} not in HTML`);
  return match[0];
}

function removedReferenceLabel(): string {
  return ["قیمت", "مرجع"].join(" ");
}

function railPercentOf(html: string, slug: string): number {
  const style = markerOf(html, slug).match(/right:\s*([\d.]+)%/);
  if (style === null) throw new Error(`marker ${slug} has no position`);
  return Number(style[1]);
}

describe("home page — prices in the server-rendered HTML", () => {
  /**
   * ⚠️ Explicit acceptance criterion: "prices must be visible with
   * JavaScript disabled". `renderToStaticMarkup` gives exactly what a
   * JavaScript-less browser sees — no effect has run.
   */
  it("each source's price is in Persian digits in the initial HTML itself", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("۱۸٬۶۱۱٬۰۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("۱۸٬۵۳۸٬۰۰۰");
  });

  it("each marker's position is in the server-rendered style attribute itself, not after hydration", async () => {
    const html = await renderHome(healthyStore());
    expect(railPercentOf(html, "wallgold")).toBeGreaterThan(0);
    expect(railPercentOf(html, "milli")).toBeGreaterThan(0);
  });

  it("the sparkline path is generated server-side and is in the HTML", async () => {
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

  it("no charting library is in the output — it's hand-rolled SVG", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("recharts");
  });
});

describe("home page — price axis", () => {
  it("renders the market summary above the price axis", async () => {
    const html = await renderHome(healthyStore());
    expect(html.indexOf("خلاصه بازار")).toBeLessThan(html.indexOf("محور قیمت طلای ۱۸ عیار"));
  });

  /**
   * ⚠️ "Right = pricier." The `right` value is the distance from the right
   * edge, so the most expensive source must have the **lowest** percent.
   */
  it("the most expensive is rightmost (right = pricier)", async () => {
    const html = await renderHome(healthyStore());
    expect(railPercentOf(html, "wallgold")).toBeLessThan(railPercentOf(html, "milli"));
    expect(railPercentOf(html, "milli")).toBeLessThan(railPercentOf(html, "talasea"));
  });

  it("the reference anchor sits at the reference platform's position without a visible label", async () => {
    const html = await renderHome(healthyStore());
    const anchor = html.match(/data-rail-anchor[^>]*style="right:\s*([\d.]+)%/);
    expect(anchor).not.toBeNull();
    expect(Number(anchor?.[1])).toBe(railPercentOf(html, "milli"));
    expect(html).not.toContain("data-rail-anchor-label");
  });

  it("the axis footer gives only the visible min and max prices", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("بیشترین قیمت ·");
    expect(html).toContain("۱۸٬۶۱۱٬۰۰۰");
    expect(html).toContain("کمترین قیمت ·");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("بازه اختلاف ۸۱٬۰۰۰ تومان");
    expect(html).toMatch(/data-rail-spread="true" class="hidden"/);
  });

  it("source marker names are visible, while prices stay in hover/focus tooltips", async () => {
    const html = await renderHome(healthyStore());
    const marker = markerOf(html, "wallgold");
    expect(marker).toContain("data-rail-label");
    expect(marker).toContain("data-rail-tooltip");
    expect(marker).toContain("rail-tooltip");
    expect(marker).toMatch(/data-rail-label="true"[\s\S]*وال‌گلد/);
    expect(marker).toMatch(/data-rail-tooltip="true"[\s\S]*۱۸٬۶۱۱٬۰۰۰/);
  });

  it("source marker names are split above and below the axis to reduce collisions", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain('data-rail-label-position="above"');
    expect(html).toContain('data-rail-label-position="below"');
  });

  /**
   * ⚠️ Guard for "the edge case that absolutely must be handled." Without a
   * floor of 50,000, these two platforms — only 2,000 toman apart — would
   * take the two ends of the axis.
   */
  it("with a negligible spread, markers stay clustered around the center", async () => {
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

  it("every marker has an accessibility label with name and price", async () => {
    const html = await renderHome(healthyStore());
    expect(markerOf(html, "wallgold")).toContain('aria-label="وال‌گلد — ۱۸٬۶۱۱٬۰۰۰ تومان"');
  });
});

describe("home page — source cards", () => {
  it("source cards do not render a reference badge", async () => {
    const html = await renderHome(healthyStore());
    expect(cardOf(html, "milli")).not.toContain(removedReferenceLabel());
    expect(cardOf(html, "wallgold")).not.toContain(removedReferenceLabel());
  });

  /**
   * ⚠️ Guard: the diff-percentage relative to the reference was removed —
   * it's neither computed nor displayed. If it ever comes back, this test
   * must fail.
   */
  it("no diff-percentage badge is on the cards", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toMatch(/[−+][۰-۹٫]+٪/);
  });
});

describe("home page — market summary", () => {
  it("gives the chart the wide column next to the current price", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("data-summary-layout");
    expect(html).toContain("sm:grid-cols-[minmax(210px,0.7fr)_minmax(0,2.3fr)]");
    expect(html).toContain("sm:gap-3");
    expect(html).toContain("data-summary-chart");
  });

  it("the big number comes from the union reference, not the chart reference platform", async () => {
    const html = await renderHome(healthyStore(), {
      history: [
        {
          platform_slug: "talair",
          points: [
            { hour: "2026-08-15T10:00:00.000Z", value: 18_520_000 },
            { hour: "2026-08-15T11:00:00.000Z", value: 18_559_700 },
          ],
          latest: 18_559_700,
          side_used: "PRICE",
        },
      ],
    });
    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰");
    expect(html).toContain("قیمت مرجع اتحادیه طلا");
    expect(html).not.toContain("میلی · تومان");
  });

  it("renders toman as a smaller unit beside summary and source prices", async () => {
    const html = await renderHome(healthyStore(), {
      history: [
        {
          platform_slug: "talair",
          points: [
            { hour: "2026-08-15T10:00:00.000Z", value: 18_520_000 },
            { hour: "2026-08-15T11:00:00.000Z", value: 18_559_700 },
          ],
          latest: 18_559_700,
          side_used: "PRICE",
        },
      ],
    });
    expect(html).toContain("text-[13px]");
    expect(html).toContain("text-[10px]");
    expect(html).toMatch(/۱۸٬۵۵۹٬۷۰۰[\s\S]*?تومان/);
    expect(cardOf(html, "wallgold")).toMatch(/۱۸٬۶۱۱٬۰۰۰[\s\S]*?تومان/);
  });

  /** ⚠️ Legal red line */
  it("the word \"average\" appears nowhere on the page", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("میانگین");
  });

  it("all three range tabs are in the server-rendered HTML so switching them never triggers a fetch", async () => {
    const html = await renderHome(healthyStore());
    for (const key of ["DAILY", "WEEKLY", "MONTHLY"]) {
      expect(html, key).toContain(`data-summary-tab="${key}"`);
    }
  });

  it("the tab labels use this page's own vocabulary, not the platform page's rate-card vocabulary", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("۲۴ ساعت اخیر");
    expect(html).toContain("هفته گذشته");
    expect(html).toContain("ماه گذشته");
  });

  /**
   * ⚠️ "Coming soon" has a fixed meaning on this page: it's reserved for
   * features that haven't been built yet (bubble meter, price alert). A
   * range that just doesn't have history yet isn't unbuilt — and on a fresh
   * install all three tabs would say "coming soon" and the whole card would
   * look unshipped.
   */
  it("a data-less tab doesn't change its label; it's just disabled", async () => {
    const html = await renderHome(healthyStore(), { history: [] });
    expect(html).toContain("۲۴ ساعت اخیر");
    const tabs = html.match(/<button[^>]*data-summary-tab="[^"]*"[^>]*>/g) ?? [];
    expect(tabs.length).toBe(3);
    for (const tab of tabs) expect(tab, tab).toContain("disabled");
  });
});

describe("home page — the table was removed", () => {
  it("no price table is on the page", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("<table");
  });

  it("every platform in the listing gets an internal link from the footer", async () => {
    const html = await renderHome(healthyStore());
    for (const platform of LISTED) {
      expect(html, platform.slug).toContain(`data-all-platform="${platform.slug}"`);
    }
  });

  it("even on a total outage, the footer listing is filled from the registry", async () => {
    const html = await renderHome({ listed: [], snapshots: {}, updatedAt: {} });
    for (const platform of REGISTRY_PLATFORMS) {
      expect(html, platform.slug).toContain(`data-all-platform="${platform.slug}"`);
    }
  });

  it("the footer listing has no price or fee — it isn't a second table", async () => {
    const html = await renderHome(healthyStore());
    const footer = html.match(/<nav[^>]*all-platforms-heading[\s\S]*?<\/nav>/);
    expect(footer).not.toBeNull();
    expect(footer?.[0]).not.toMatch(/[۰-۹]٬[۰-۹]/);
  });

  it("goldika is in the store but never renders (PERMISSION_PENDING)", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("گلدیکا");
    expect(html).not.toContain("goldika");
  });
});

describe("home page — disabled cards", () => {
  it("the bubble meter renders but claims no number", async () => {
    const html = await renderHome(healthyStore());
    const card = html.match(/<section[^>]*data-card="bubble"[\s\S]*?<\/section>/);
    expect(card).not.toBeNull();
    expect(card?.[0]).toContain("حباب سنج");
    expect(card?.[0]).toContain("به زودی فعال می‌شود");
    expect(card?.[0]).not.toMatch(/[۰-۹]٬[۰-۹]/);
  });

  it("the price-alert card is disabled too", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("هشدار قیمت");
  });

  it("the calculator shell is server-rendered", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain("ماشین حساب طلای زینتی");
    expect(html).toContain("اجرت ساخت (٪)");
  });
});

describe("home page — source outage ⟸ staleness, not error", () => {
  it("when one source dies the page still renders and the rest stay in place", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();

    const html = await renderHome(store);
    expect(html).toContain("وال‌گلد");
    expect(html).toContain("میلی");
    expect(cardOf(html, "talasea")).toContain("قیمت در دسترس نیست");
  });

  it("a priceless platform gets no axis marker but its card remains", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    const html = await renderHome(store);
    expect(html).not.toContain('data-rail-marker="talasea"');
    expect(() => cardOf(html, "talasea")).not.toThrow();
  });

  it("a total outage of all three sources ⟸ the page still renders", async () => {
    const html = await renderHome({ listed: [], snapshots: {}, updatedAt: {} });
    expect(html).toContain("محور قیمت طلای ۱۸ عیار");
    expect(html).toContain("قیمت در دسترس نیست");
  });

  it("the price axis card has no immediate refresh CTA", async () => {
    const html = await renderHome(healthyStore());
    expect(html).not.toContain("همین حالا بگیر");
    expect(html).not.toContain("data-rail-refresh");
  });

  it("the price axis timer marker starts with the 30-second count inside it", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain('data-rail-countdown="۳۰"');
  });

  it("with only one priced source, the axis isn't drawn but the page is fine", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.snapshots["wallgold"] = null;
    store.snapshots["melligold"] = null;
    store.snapshots["tlyn"] = null;
    const html = await renderHome(store);
    expect(html).toContain("برای رسم محور دست‌کم دو سکوی قیمت‌دار لازم است");
  });

  it("a platform with an unknown fee still has its own number and isn't left out", async () => {
    const html = await renderHome(storeWithUnknownFee());
    expect(html).toContain("ملی‌گلد");
  });

  /**
   * ⚠️ Requirement: data age must be in the server-rendered HTML itself.
   * Before the redesign, every table row had its own label; now there's one
   * page-level label on the axis. Removing the table must not take this
   * down with it.
   */
  it("the \"last updated\" label with <time datetime> is in the HTML itself", async () => {
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

describe("home page — price axis countdown", () => {
  it("decrements from 30 to 1 in the same 30-second cycle as the fuse", () => {
    const updatedAt = "2026-08-15T13:00:00.000Z";
    const at = (seconds: number) => new Date("2026-08-15T13:00:00.000Z").getTime() + seconds * 1000;

    expect(railCountdownSeconds(updatedAt, at(0))).toBe(30);
    expect(railCountdownSeconds(updatedAt, at(1))).toBe(29);
    expect(railCountdownSeconds(updatedAt, at(29))).toBe(1);
    expect(railCountdownSeconds(updatedAt, at(30))).toBe(30);
  });
});

describe("home page — blog sections (owner's decision: no empty box)", () => {
  it("with no posts, the sidebar and closing section don't render at all", async () => {
    const html = await renderHome(healthyStore(), { posts: [] });
    expect(html).not.toContain("تازه‌ترین نوشته‌ها");
    expect(html).not.toContain("بیشتر بخوانید");
  });

  it("with two posts, the newest becomes the \"featured article\" and the rest go in the sidebar", async () => {
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
        {
          slug: "ayar-tala",
          title_fa: "عیار طلا یعنی چه؟",
          body_md: "عیار نسبت طلای خالص به کل وزن است.",
          status: "published",
          published_at: "2026-07-20T09:00:00.000Z",
          updated_at: "2026-07-20T09:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("تازه‌ترین نوشته‌ها");
    expect(html).toContain("بیشتر بخوانید");
    expect(html).toContain('href="/blog/hazine-raft-o-bargasht"');
    expect(html).toContain("هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.");
  });

  /**
   * ⚠️ "Featured" isn't an editorial claim — the backend has no
   * `is_featured` flag (per the gaps doc) and the newest post is selected.
   * The no-duplication test matters more than the card itself: without it,
   * a single post would appear twice on one page.
   */
  it("the \"featured article\" card renders with a CTA and that same post isn't repeated in the sidebar", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "rahnama-kharid",
          title_fa: "راهنمای کامل خرید طلای زینتی",
          body_md: "نکات کلیدی برای خرید هوشمندانه طلای زینتی.",
          status: "published",
          published_at: "2026-08-05T09:00:00.000Z",
          updated_at: "2026-08-05T09:00:00.000Z",
        },
        {
          slug: "ayar-tala",
          title_fa: "عیار طلا یعنی چه؟",
          body_md: "عیار نسبت طلای خالص به کل وزن است.",
          status: "published",
          published_at: "2026-07-20T09:00:00.000Z",
          updated_at: "2026-07-20T09:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("مقاله ویژه");
    expect(html).toContain("مطالعه مقاله ←");

     // ⚠️ Only the sidebar is checked, not the whole page: overlap between
     // "latest" and "read more" is already intentional (two different views
     // over the same set), but the featured article must not repeat in latest.
    const sidebar = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? "";
    expect(sidebar).not.toBe("");
    expect(sidebar).not.toContain("راهنمای کامل خرید طلای زینتی");
    expect(sidebar).toContain('href="/blog/ayar-tala"');
  });

  it("with only one post, that post is the \"featured article\" and the sidebar doesn't render empty", async () => {
    const html = await renderHome(healthyStore(), {
      posts: [
        {
          slug: "tanha-post",
          title_fa: "تنها نوشته‌ی سایت",
          body_md: "یک متن کوتاه.",
          status: "published",
          published_at: "2026-08-05T09:00:00.000Z",
          updated_at: "2026-08-05T09:00:00.000Z",
        },
      ],
    });
    expect(html).toContain("مقاله ویژه");
    expect(html).toContain("تنها نوشته‌ی سایت");
    expect(html).not.toContain("تازه‌ترین نوشته‌ها");
  });

  it("a draft never reaches the home page", async () => {
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

  it("the featured image in the sidebar and closing cards: img with src/width/height/alt", async () => {
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

  it("a post with no featured image: no img in the sidebar or the closing cards", async () => {
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

describe("root shell — Persian, right-to-left, and theme with no flash", () => {
  /**
   * ⚠️ A code-level guard, not a render one. `RootShell` uses
   * `HeadContent`/`Scripts` and doesn't render without a `RouterProvider`
   * (verified empirically: "useRouter must be used inside a
   * RouterProvider"). The real render of `<html lang="fa" dir="rtl">` was
   * verified against the built server; this guard stops those same
   * attributes from being silently dropped in a future rewrite.
   * ⚠️ The pattern is deliberately insensitive to attribute order or
   * spacing: the previous version was `/<html\s+lang="fa"\s+dir="rtl">/`
   * and broke the moment a third attribute was added and the formatter
   * wrapped the tag across multiple lines — without anything actually
   * being broken.
   */
  function rootSource(): string {
    return readFileSync(join(__dirname, "..", "src/routes/__root.tsx"), "utf8");
  }

  /**
   * ⚠️ `<html\s`, not `<html\b`: this very file's own comments contain the
   * string `<html>`, and the looser pattern would match those first and
   * fail the test with a misleading message. Requiring at least one
   * attribute separates the real JSX tag from comment text.
   */
  function htmlTag(): string {
    const match = rootSource().match(/<html\s[^>]*>/);
    if (match === null) throw new Error("attributed <html> tag not found in root shell");
    return match[0];
  }

  it("the root shell has lang=fa and dir=rtl", () => {
    expect(htmlTag()).toMatch(/lang="fa"/);
    expect(htmlTag()).toMatch(/dir="rtl"/);
  });

  it("writes the theme server-side and fixed, and silences the hydration warning on that same element", () => {
    expect(htmlTag()).toMatch(/data-theme=\{SERVER_THEME\}/);
    expect(htmlTag()).toMatch(/suppressHydrationWarning/);
  });

  /**
   * ⚠️ The script's location is what matters, not just its presence: it
   * must be **inside `<head>`** so the browser runs it synchronously and
   * the attribute lands before the first pixel. If it's ever moved to the
   * end of `<body>`, the white flash comes back and no other test would
   * catch it.
   */
  it("the theme-detection script is inside <head>, not in the body", () => {
    const head = rootSource().match(/<head>[\s\S]*?<\/head>/);
    expect(head, "بلوک <head> در پوسته‌ی ریشه نیست").not.toBeNull();
    expect(head?.[0]).toContain("THEME_INIT_SCRIPT");
  });

  it("the inline script writes the same attribute and key that lib/theme reads", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_ATTRIBUTE));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
  });

  it("the dark selector in styles.css is scoped with that same attribute", () => {
    const css = readFileSync(join(__dirname, "..", "src/styles.css"), "utf8");
    expect(css).toContain(`[${THEME_ATTRIBUTE}="dark"]`);
    expect(css).toMatch(/@custom-variant\s+dark\s+\(&:is\(\[data-theme="dark"\]\s+\*\)\)/);
  });
});

describe("home page — Article 5 banner and legal notice", () => {
  it("the page has a /go/ link ⟸ the Article 5 banner is in the server-rendered HTML", async () => {
    const html = await renderHome(healthyStore());
    expect(html).toContain('data-legal-notice="madde-5"');
    expect(html).toContain("معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود");
    expect(html).toContain("تابلو معامله‌گر یا مشاور سرمایه‌گذاری نیست.");
  });
});

describe("home page — each platform's staleness on its own card", () => {
  /**
   * ⚠️ A page-level label isn't enough: it's the max time across all
   * platforms, so one dead platform stays hidden behind the freshness of
   * the rest. The old table had this per row; it got lost when the table
   * was removed, and code review caught it.
   */
  it("every source card has its own time label in the server-rendered HTML", async () => {
    const html = await renderHome(healthyStore());
    for (const slug of ["wallgold", "talasea", "milli"]) {
      expect(cardOf(html, slug), slug).toMatch(/<time[^>]*data-live="updated-at"/);
    }
  });

  it("a stale platform gets \"stale\" on its own card, even when the rest are fresh", async () => {
    const store = healthyStore();
    store.updatedAt["talasea"] = staleIso();
    const html = await renderHome(store);
    expect(cardOf(html, "talasea")).toContain("کهنه");
    expect(cardOf(html, "wallgold")).not.toContain("کهنه");
  });

  it("a platform with no history doesn't lie", async () => {
    const store = healthyStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = null;
    const html = await renderHome(store);
    expect(cardOf(html, "talasea")).toContain("هنوز داده‌ای ثبت نشده است");
  });
});
