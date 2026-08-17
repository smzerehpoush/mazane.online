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

describe("Redis outage: valid slugs stay 200, unknown ones stay 404", () => {
  it("every registry platform slug resolves and has its name", async () => {
    for (const platform of REGISTRY_PLATFORMS) {
      const resolved = await resolveSlug(platform.slug);
      expect(resolved?.kind, platform.slug).toBe("platform");
    }
  });

  it("platform page gives a full payload with a null snapshot — the staleness state", async () => {
    const page = await slugPage("wallgold");
    expect(page?.kind).toBe("platform");
    if (page?.kind !== "platform") return;
    expect(page.platform.name_fa).toBe("وال‌گلد");
    expect(page.snapshot).toBeNull();
    expect(page.updatedAt).toBeNull();
    expect(page.hasOutbound).toBe(true);
  });

  it("published instrument page resolves and has rows for its supporting platforms", async () => {
    const page = await slugPage("tala-18");
    expect(page?.kind).toBe("instrument");
    if (page?.kind !== "instrument") return;
    expect(page.listing.name_fa).toBe("طلای ۱۸ عیار");
    expect(page.rows.map((row) => row.platform.slug)).toEqual(
      page.listing.supporting_platform_slugs,
    );
    expect(page.rows.every((row) => row.snapshot === null)).toBe(true);
  });

  it("unpublished instrument and unknown slug both still 404", async () => {
    for (const listing of REGISTRY_INSTRUMENTS.filter((item) => !item.published)) {
      expect(await slugPage(listing.slug), listing.slug).toBeNull();
    }
    expect(await slugPage("no-such-thing")).toBeNull();
    expect(await slugPage("blog")).toBeNull();
  });
});

describe("Redis outage: sitemap stays complete", () => {
  it("every platform and published instrument is in the sitemap", async () => {
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
    expect(entries.length).toBeGreaterThan(REGISTRY_PLATFORMS.length);
  });
});

describe("Postgres outage: an incomplete sitemap is never published", () => {
  it("the strict version doesn't swallow the store error, but the regular version does", async () => {
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

describe("live payload always takes precedence over the static registry", () => {
  it("a new collector platform is visible without a web deploy", async () => {
    setPriceSource({
      getListedPlatforms: async () => [
        { slug: "sekoye-taze", name_fa: "سکوی تازه", data_policy: "ALLOWED" },
      ],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [],
    });
    expect((await resolveSlug("sekoye-taze"))?.kind).toBe("platform");
    expect((await listPlatforms()).map((p) => p.slug)).toEqual(["sekoye-taze"]);
    expect(await resolveSlug("wallgold")).toBeNull();
  });

  it("a newly-opened collector publish gate takes precedence over the static registry", async () => {
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
    expect((await resolveSlug("noghre"))?.kind).toBe("instrument");
  });
});
