import { createServerFn } from "@tanstack/react-start";

import type {
  InstrumentPageData,
  PlatformPageData,
  SlugPageData,
} from "@/components/content/SlugPageView";
import type { PublishedPost } from "./blog";
import { assembleSlugPage } from "./page-data";
import { getPublishedPost, listPublishedPosts } from "./server/blog-source";
import { getPlatformHistory } from "./server/history-source";
import { getReferencePrice } from "./server/reference-price-source";
import {
  fetchRowsForPlatforms,
  getInstruments,
  getPlatformSnapshot,
  getUpdatedAt,
  resolveSlug,
} from "./server/price-source";

export const loadBlogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ posts: PublishedPost[] }> => ({
    posts: await listPublishedPosts(),
  }),
);

/**
 * ⚠️ Unlike the listing, the Postgres error here is **not** swallowed (the
 * rule documented in `lib/blog.ts`): a transient error must not pass itself
 * off as a 404, or Google will drop the page from its index. The error
 * propagates and the route's error boundary returns a 500.
 */
export const loadBlogPost = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<PublishedPost | null> => getPublishedPost(data.slug));

export type { InstrumentPageData, PlatformPageData, SlugPageData };

export const loadSlugPage = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<SlugPageData | null> =>
    assembleSlugPage(data.slug, {
      resolveSlug,
      fetchRowsForPlatforms,
      getPlatformSnapshot,
      getUpdatedAt,
      getInstruments,
      getPlatformHistory,
      getReferencePrice,
    }),
  );
