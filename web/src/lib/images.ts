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
}

export interface UploadedImage {
  objectKey: string;
  width: number;
  height: number;
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

export function postImageAsset(post: {
  image_url?: string | null;
  image_alt?: string | null;
  image_width?: number | null;
  image_height?: number | null;
}): ImageAsset | null {
  const url = post.image_url ?? null;
  const alt = post.image_alt ?? null;
  const width = post.image_width ?? null;
  const height = post.image_height ?? null;
  if (url === null || alt === null || width === null || height === null) return null;
  return { url, alt, width, height };
}
