/**
 * ⚠️ Deliberate deviation from the ticket's prose: `ImageStore.upload`'s
 * signature also takes a `slug` argument (first), not just
 * `(bytes, contentType)`. Reason: object naming follows the
 * `posts/<slug>/<hash>.webp` design, and the store itself is a shared
 * bucket/client — exactly the same reason `ViewCounterSource.recordView(slug)`
 * and `AdminPostsSource.getPost(slug)` pass the key to the method rather
 * than to the factory.
 */

export interface ImageAsset {
  url: string;
  alt: string;
  width: number;
  height: number;
  srcset: string | null;
}

export interface UploadedImageVariant {
  objectKey: string;
  width: number;
}

/**
 * ⚠️ `variants` is optional on purpose and must stay optional: every image
 * uploaded before ticket 78 exists in the bucket at one width only, and no
 * backfill was run. A reader that assumes the narrow variants exist will
 * hand the browser a `srcset` full of 404s.
 */
export interface UploadedImage {
  objectKey: string;
  width: number;
  height: number;
  variants?: UploadedImageVariant[];
}

export interface ImageStore {
  upload(slug: string, bytes: Uint8Array, contentType: string): Promise<UploadedImage>;
}

export type ImageStoreFactory = () => ImageStore;

let activeStore: ImageStore | null = null;
let defaultFactory: ImageStoreFactory | null = null;

export function setImageStore(store: ImageStore): void {
  activeStore = store;
}

export function setDefaultImageStore(factory: ImageStoreFactory): void {
  defaultFactory = factory;
}

export function resetImageStore(): void {
  activeStore = null;
}

function source(): ImageStore {
  if (activeStore !== null) return activeStore;
  if (defaultFactory === null) {
    throw new Error(
      "No ImageStore registered — import from «@/lib/server/image-store» or call setImageStore",
    );
  }
  activeStore = defaultFactory();
  return activeStore;
}

export async function uploadImage(
  slug: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<UploadedImage> {
  return source().upload(slug, bytes, contentType);
}

export function buildSrcset(entries: readonly { url: string; width: number }[]): string | null {
  const byWidth = new Map<number, string>();
  for (const entry of entries) {
    if (entry.url.trim() === "") continue;
    if (!Number.isInteger(entry.width) || entry.width <= 0) continue;
    if (byWidth.has(entry.width)) continue;
    byWidth.set(entry.width, entry.url);
  }
  if (byWidth.size < 2) return null;
  return [...byWidth.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([width, url]) => `${url} ${width}w`)
    .join(", ");
}

export function postImageAsset(post: {
  image_url?: string | null;
  image_alt?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  image_srcset?: string | null;
}): ImageAsset | null {
  const url = post.image_url ?? null;
  const alt = post.image_alt ?? null;
  const width = post.image_width ?? null;
  const height = post.image_height ?? null;
  if (url === null || alt === null || width === null || height === null) return null;
  const raw = post.image_srcset ?? null;
  const srcset = raw === null || raw.trim() === "" ? null : raw;
  return { url, alt, width, height, srcset };
}
