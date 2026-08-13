/**
 * ⚠️ تفاوت آگاهانه با نثر تیکت: امضای `ImageStore.upload` یک آرگومان `slug`
 * هم می‌گیرد (اول)، نه فقط `(bytes, contentType)`. دلیل: نام‌گذاری شیء طبق
 * طراحی `posts/<slug>/<hash>.webp` است و خودِ استور یک بوکت/کلاینت مشترک
 * است، دقیقاً همان دلیلی که `ViewCounterSource.recordView(slug)` و
 * `AdminPostsSource.getPost(slug)` کلید را به متد می‌دهند نه به کارخانه.
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
      "هیچ ImageStore ثبت نشده — از «@/lib/server/image-store» بخوان یا setImageStore صدا بزن",
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
