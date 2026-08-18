/**
 * ⚠️ The gate the related-links engine exists for: **every published post must
 * carry at least one internal link into a tool or an asset page.** The fixtures
 * below are not invented — they are read straight out of `collector/migrations`,
 * so a post that ships with the repo and lands in no cluster fails here rather
 * than quietly rendering a dead-end page.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BlogPostView } from "../src/components/content/BlogViews";
import { SlugPageView } from "../src/components/content/SlugPageView";
import { listPublishedPosts, type BlogPost, type PublishedPost } from "../src/lib/blog";
import {
  CLUSTER_IDS,
  clusterCandidates,
  clusterForPath,
  clusterForPost,
  relatedLinks,
  relatedLinksForPath,
  relatedLinksForPost,
  type ClusterId,
  type RelatedLinks,
} from "../src/lib/clusters";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "../src/lib/registry";
import { STATIC_PAGE_SLUGS } from "../src/lib/slugs";
import { TOOLS, TOOLS_HUB_PATH } from "../src/lib/tools";
import { MazaneChist } from "../src/routes/mazane-chist";
import { SekehPage } from "../src/routes/sekeh";
import { healthyStore, seed, seedBlog, slugPageData } from "./support/seed";

const MIGRATIONS = fileURLToPath(new URL("../../collector/migrations/", import.meta.url));

const POST_INSERT =
  /insert into posts[\s\S]{0,200}?values\s*\(\s*'([a-z0-9-]+)',\s*'([^']*)',\s*\$md\$([\s\S]*?)\$md\$[\s\S]{0,80}?'published'/g;

function shippedPosts(): PublishedPost[] {
  const posts: PublishedPost[] = [];
  for (const name of readdirSync(MIGRATIONS).sort()) {
    if (!name.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS, name), "utf8");
    for (const [, slug, title, body] of sql.matchAll(POST_INSERT)) {
      posts.push({
        slug: slug ?? "",
        title_fa: title ?? "",
        body_md: body ?? "",
        status: "published",
        published_at: "2026-08-06T06:30:00.000Z",
        updated_at: "2026-08-06T06:30:00.000Z",
      });
    }
  }
  return posts;
}

const TOOL_PATHS: ReadonlySet<string> = new Set(TOOLS.map((tool) => tool.href));

const ASSET_PATHS: ReadonlySet<string> = new Set([
  "/sekeh",
  ...REGISTRY_INSTRUMENTS.filter((item) => item.published).map((item) => `/${item.slug}`),
]);

const KNOWN_ROUTES: ReadonlySet<string> = new Set(["/", "/blog", "/about"]);

function resolvesToARoute(href: string): boolean {
  if (KNOWN_ROUTES.has(href)) return true;
  if (href.startsWith("/blog/")) return true;
  const slug = href.slice(1);
  if (STATIC_PAGE_SLUGS.has(slug)) return true;
  if (REGISTRY_INSTRUMENTS.some((item) => item.published && item.slug === slug)) return true;
  return REGISTRY_PLATFORMS.some((platform) => platform.slug === slug);
}

function hrefsOf(links: RelatedLinks): string[] {
  return [links.tools[0].href, links.tools[1].href, links.anchor.href, links.hub.href];
}

function renderedHrefs(html: string): string[] {
  return [...html.matchAll(/data-related-link="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function renderedCluster(html: string): string | null {
  return html.match(/data-related-cluster="([^"]+)"/)?.[1] ?? null;
}

const PAGE_PATHS: readonly string[] = [
  "/mohasebe-tala",
  "/mohasebe-forush-tala",
  "/mazane-chist",
  "/sekeh",
  ...REGISTRY_INSTRUMENTS.filter((item) => item.published).map((item) => `/${item.slug}`),
  ...REGISTRY_PLATFORMS.map((platform) => `/${platform.slug}`),
];

describe("cluster registry — every declared destination is real and reachable", () => {
  it("covers every cluster id with candidates, and none is empty", () => {
    expect(CLUSTER_IDS.length).toBeGreaterThan(1);
    for (const cluster of CLUSTER_IDS) {
      expect(clusterCandidates(cluster).length, cluster).toBeGreaterThanOrEqual(5);
    }
  });

  /**
   * ⚠️ The clusters name tool paths as literals, so this is the only thing
   * stopping a tool added to `TOOLS` from being invisible to the engine — a
   * new calculator nothing links to is exactly the gap this ticket closed.
   */
  it("every tool in the registry is claimed by at least one cluster", () => {
    const clustered = new Set(
      CLUSTER_IDS.flatMap((cluster) =>
        clusterCandidates(cluster).map((candidate) => candidate.href),
      ),
    );
    for (const tool of TOOLS) {
      expect(clustered.has(tool.href), tool.href).toBe(true);
    }
  });

  it("every candidate href resolves to a route that exists", () => {
    for (const cluster of CLUSTER_IDS) {
      for (const candidate of clusterCandidates(cluster)) {
        expect(resolvesToARoute(candidate.href), `${cluster} → ${candidate.href}`).toBe(true);
      }
    }
  });

  it("no cluster lists the same destination twice", () => {
    for (const cluster of CLUSTER_IDS) {
      const hrefs = clusterCandidates(cluster).map((candidate) => candidate.href);
      expect(new Set(hrefs).size, cluster).toBe(hrefs.length);
    }
  });

  it("every cluster keeps a tool and a price candidate in reserve, so self-exclusion can't starve it", () => {
    for (const cluster of CLUSTER_IDS) {
      const candidates = clusterCandidates(cluster);
      expect(candidates.filter((item) => item.kind === "tool").length, cluster).toBeGreaterThan(1);
      expect(candidates.filter((item) => item.kind === "price").length, cluster).toBeGreaterThan(1);
    }
  });

  it("anchor text is descriptive — no «اینجا کلیک کنید» and no bare «بیشتر»", () => {
    for (const cluster of CLUSTER_IDS) {
      for (const candidate of clusterCandidates(cluster)) {
        expect(candidate.label.length, `${cluster} → ${candidate.href}`).toBeGreaterThan(12);
        expect(candidate.label).not.toContain("کلیک");
        expect(candidate.label).not.toContain("اینجا");
        expect(candidate.label.trim()).not.toBe("بیشتر بخوانید");
      }
    }
  });
});

describe("cluster selection — four distinct links, never one of them the current page", () => {
  it("each page in the site gets four resolvable links and never links to itself", () => {
    for (const path of PAGE_PATHS) {
      const links = relatedLinksForPath(path);
      const hrefs = hrefsOf(links);
      expect(hrefs, path).toHaveLength(4);
      expect(new Set(hrefs).size, path).toBe(4);
      expect(hrefs, path).not.toContain(path);
      for (const href of hrefs) {
        expect(resolvesToARoute(href), `${path} → ${href}`).toBe(true);
      }
    }
  });

  it("each page's block reaches a tool page, an asset page and the hub", () => {
    for (const path of PAGE_PATHS) {
      const hrefs = hrefsOf(relatedLinksForPath(path));
      expect(
        hrefs.some((href) => TOOL_PATHS.has(href)),
        path,
      ).toBe(true);
      expect(
        hrefs.some((href) => ASSET_PATHS.has(href)),
        path,
      ).toBe(true);
      expect(hrefs, path).toContain(TOOLS_HUB_PATH);
    }
  });

  it("the block never leaves the site — no absolute URL and no /go/ revenue link", () => {
    for (const path of PAGE_PATHS) {
      for (const href of hrefsOf(relatedLinksForPath(path))) {
        expect(href.startsWith("/"), `${path} → ${href}`).toBe(true);
        expect(href.startsWith("/go/"), `${path} → ${href}`).toBe(false);
      }
    }
  });

  it("it never singles out one platform — a related block is not a ranking surface", () => {
    const platformPaths = new Set(REGISTRY_PLATFORMS.map((platform) => `/${platform.slug}`));
    for (const cluster of CLUSTER_IDS) {
      for (const candidate of clusterCandidates(cluster)) {
        expect(platformPaths.has(candidate.href), `${cluster} → ${candidate.href}`).toBe(false);
      }
    }
  });
});

describe("the cluster actually selects — the block is not one boilerplate strip", () => {
  const SAMPLE = "/blog/nemune";

  it("no two clusters produce the same set of links on the same page", () => {
    const shapes = CLUSTER_IDS.map((cluster) => hrefsOf(relatedLinks(cluster, SAMPLE)).join("|"));
    expect(new Set(shapes).size).toBe(CLUSTER_IDS.length);
  });

  it("each cluster writes its own heading and its own lead sentence", () => {
    const headings = CLUSTER_IDS.map((cluster) => relatedLinks(cluster, SAMPLE).heading);
    const leads = CLUSTER_IDS.map((cluster) => relatedLinks(cluster, SAMPLE).lead);
    expect(new Set(headings).size).toBe(CLUSTER_IDS.length);
    expect(new Set(leads).size).toBe(CLUSTER_IDS.length);
  });

  /**
   * ⚠️ The same destination reached from two topics must not carry the same
   * anchor text. Identical anchors on every page is what turns a related block
   * into sitewide boilerplate, which is exactly what Google discounts.
   */
  it("a shared destination gets topic-specific anchor text, not one reused label", () => {
    const byHref = new Map<string, Set<string>>();
    for (const cluster of CLUSTER_IDS) {
      for (const candidate of clusterCandidates(cluster)) {
        const labels = byHref.get(candidate.href) ?? new Set<string>();
        labels.add(candidate.label);
        byHref.set(candidate.href, labels);
      }
    }
    for (const [href, labels] of byHref) {
      expect(labels.size, href).toBeGreaterThan(1);
    }
  });

  it("two pages in different clusters do not render the same four links", () => {
    expect(hrefsOf(relatedLinksForPath("/sekeh")).join("|")).not.toBe(
      hrefsOf(relatedLinksForPath("/mohasebe-tala")).join("|"),
    );
    expect(hrefsOf(relatedLinksForPath("/wallgold")).join("|")).not.toBe(
      hrefsOf(relatedLinksForPath("/mazane-chist")).join("|"),
    );
  });
});

describe("cluster resolution — pages declare, posts are matched on their own vocabulary", () => {
  it("tool, guide, asset and platform pages declare their cluster", () => {
    expect(clusterForPath("/mohasebe-tala")).toBe("jewelry");
    expect(clusterForPath("/mohasebe-forush-tala")).toBe("sell-back");
    expect(clusterForPath("/mazane-chist")).toBe("mazane");
    expect(clusterForPath("/sekeh")).toBe("coin");
    expect(clusterForPath("/tala-18")).toBe("gold-price");
    expect(clusterForPath("/wallgold")).toBe("platforms");
  });

  function post(slug: string, title: string, body: string): BlogPost {
    return {
      slug,
      title_fa: title,
      body_md: body,
      status: "published",
      published_at: "2026-08-01T09:00:00.000Z",
      updated_at: "2026-08-01T09:00:00.000Z",
    };
  }

  const CASES: ReadonlyArray<[string, BlogPost, ClusterId]> = [
    [
      "an ojrat post",
      post("ojrat", "اجرت ساخت چقدر است؟", "اجرت و مالیات روی فاکتور طلای نو نوشته می‌شود."),
      "jewelry",
    ],
    [
      "a sell-back post",
      post("forush", "فروش طلا به مغازه", "خریدار هنگام آب کردن از ارزش طلا کسر می‌کند."),
      "sell-back",
    ],
    [
      "a mazane post",
      post("mazane", "مظنه و مثقال", "مظنه قیمت یک مثقال طلای آب‌شده است."),
      "mazane",
    ],
    ["a coin post", post("sekeh", "حباب سکه امامی", "نیم سکه و ربع سکه حباب مستقل دارند."), "coin"],
    [
      "a platform-fee post",
      post("karmozd", "کارمزد سکوهای آنلاین", "کارمزد خرید و فروش هر سکو با رفت‌وبرگشت فرق دارد."),
      "platforms",
    ],
  ];

  for (const [name, sample, expected] of CASES) {
    it(`${name} lands in the ${expected} cluster`, () => {
      expect(clusterForPost(sample)).toBe(expected);
    });
  }

  it("a post with no topical signal still gets a cluster instead of nothing", () => {
    expect(clusterForPost(post("bi-neshane", "یادداشت کوتاه", "بدون واژه‌ی کلیدی."))).toBe(
      "gold-price",
    );
  });

  it("ZWNJ spelling variants do not split a post away from its cluster", () => {
    const withZwnj = post("a", "طلای آب‌شده", "آب‌شده و مثقال");
    const without = post("b", "طلای آبشده", "آبشده و مثقال");
    expect(clusterForPost(without)).toBe(clusterForPost(withZwnj));
  });

  it("an explicit per-post declaration overrides the vocabulary match", () => {
    const declared = post(
      "maliyat-tala-1405",
      "مالیات طلا در سال ۱۴۰۵",
      "کارمزد سکو کارمزد سکو کارمزد سکو",
    );
    expect(clusterForPost(declared)).toBe("jewelry");
  });
});

describe("every published post reaches a tool or an asset page", () => {
  it("the migration reader actually found the posts that ship with the repo", () => {
    expect(shippedPosts().length).toBeGreaterThanOrEqual(3);
  });

  it("a post's block comes from its own cluster and never links back to itself", () => {
    for (const item of shippedPosts()) {
      const links = relatedLinksForPost(item);
      expect(links.cluster, item.slug).toBe(clusterForPost(item));
      expect(hrefsOf(links), item.slug).not.toContain(`/blog/${item.slug}`);
    }
  });

  it("each published post renders at least one internal link into a tool or asset page", async () => {
    seedBlog(shippedPosts());
    const posts = await listPublishedPosts();
    expect(posts.length).toBeGreaterThanOrEqual(3);
    for (const item of posts) {
      const hrefs = renderedHrefs(renderToStaticMarkup(<BlogPostView post={item} />));
      expect(hrefs.length, item.slug).toBe(4);
      expect(
        hrefs.some((href) => TOOL_PATHS.has(href) || ASSET_PATHS.has(href)),
        item.slug,
      ).toBe(true);
    }
  });

  it("the post's block is the one its cluster picked, not a fixed footer", async () => {
    const posts = shippedPosts();
    seedBlog(posts);
    const clusters = posts.map((item) =>
      renderedCluster(renderToStaticMarkup(<BlogPostView post={item} />)),
    );
    for (const [index, item] of posts.entries()) {
      expect(clusters[index], item.slug).toBe(clusterForPost(item));
    }
    expect(new Set(clusters).size).toBeGreaterThan(1);
  });
});

describe("/mazane-chist links to the pages it is actually about", () => {
  const html = renderToStaticMarkup(<MazaneChist />);

  it("reaches both calculators and the gold price page", () => {
    for (const href of ["/mohasebe-tala", "/mohasebe-forush-tala", "/tala-18", TOOLS_HUB_PATH]) {
      expect(renderedHrefs(html), href).toContain(href);
    }
  });

  it("its outgoing content links are the mazane cluster's, not a lone link back to the home page", () => {
    expect(renderedCluster(html)).toBe("mazane");
    expect(renderedHrefs(html)).not.toContain("/");
    expect(renderedHrefs(html)).toHaveLength(4);
  });
});

describe("the block is on every surface the funnel runs through", () => {
  it("the asset page carries the gold-price cluster", async () => {
    seed(healthyStore());
    const data = await slugPageData("tala-18");
    expect(data).not.toBeNull();
    const html = renderToStaticMarkup(<SlugPageView data={data!} />);
    expect(renderedCluster(html)).toBe("gold-price");
    expect(renderedHrefs(html)).toContain("/sekeh");
  });

  it("a platform page carries the platforms cluster and points back at the comparison", async () => {
    seed(healthyStore());
    const data = await slugPageData("wallgold");
    expect(data).not.toBeNull();
    const html = renderToStaticMarkup(<SlugPageView data={data!} />);
    expect(renderedCluster(html)).toBe("platforms");
    expect(renderedHrefs(html)).toContain("/tala-18");
  });

  it("the coin page carries the coin cluster", () => {
    const html = renderToStaticMarkup(
      <SekehPage
        data={{ generated_at: "2026-08-15T20:17:15.475Z", coins: [], emamiBubble: null }}
      />,
    );
    expect(renderedCluster(html)).toBe("coin");
    expect(renderedHrefs(html)).toContain("/tala-18");
  });
});
