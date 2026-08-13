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
 * ⚠️ برخلاف فهرست، خطای پستگرس اینجا قورت داده **نمی‌شود** (قاعده‌ی مستند
 * `lib/blog.ts`): خطای گذرا نباید ۴۰۴ جا بزند، وگرنه گوگل صفحه را از ایندکس
 * می‌اندازد. خطا بالا می‌رود و مرز خطای مسیر ۵۰۰ می‌دهد.
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
