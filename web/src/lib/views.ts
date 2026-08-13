/**
 * ⚠️ **چرا شمارش از مرورگر است نه از رندر سرور:** HTML صفحه‌ها در لبه‌ی
 * آروان کش می‌شود. اگر در loader می‌شمردیم، فقط cache-miss ها
 * شمرده می‌شدند — عددی که بیشتر رفتار کش را توصیف می‌کند تا خواننده را، و
 * با روشن/خاموش شدن کش چند برابر جابه‌جا می‌شود.
 */

import type { PublishedPost } from "./blog";

export type ViewCounts = Readonly<Record<string, number>>;

export interface ViewCounterSource {
  recordView(slug: string): Promise<void>;
  viewCounts(): Promise<ViewCounts>;
}

export type ViewCounterFactory = () => ViewCounterSource;

let activeSource: ViewCounterSource | null = null;
let defaultFactory: ViewCounterFactory | null = null;

export function setViewCounter(source: ViewCounterSource): void {
  activeSource = source;
}

export function setDefaultViewCounter(factory: ViewCounterFactory): void {
  defaultFactory = factory;
}

export function resetViewCounter(): void {
  activeSource = null;
}

function source(): ViewCounterSource | null {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) return null;
  activeSource = defaultFactory();
  return activeSource;
}

export async function recordPostView(slug: string): Promise<boolean> {
  const counter = source();
  if (counter === null) return false;
  try {
    await counter.recordView(slug);
    return true;
  } catch (error) {
    console.error("view counter unavailable; view not recorded", error);
    return false;
  }
}

export async function getViewCounts(): Promise<ViewCounts> {
  const counter = source();
  if (counter === null) return {};
  try {
    return await counter.viewCounts();
  } catch (error) {
    console.error("view counter unavailable; falling back to date order", error);
    return {};
  }
}

export function hasViewData(posts: PublishedPost[], counts: ViewCounts): boolean {
  return posts.some((post) => (counts[post.slug] ?? 0) > 0);
}

export function byPopularity(posts: PublishedPost[], counts: ViewCounts): PublishedPost[] {
  if (!hasViewData(posts, counts)) return posts;
  return [...posts].sort((a, b) => {
    const diff = (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0);
    if (diff !== 0) return diff;
    return Date.parse(b.published_at) - Date.parse(a.published_at);
  });
}
