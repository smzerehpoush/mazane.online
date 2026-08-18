import { SITE_URL } from "./site";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/png";

export const OG_HOME_KEY = "home";
export const OG_SEKEH_KEY = "sekeh";

export function ogKeyForPath(path: string): string {
  const trimmed = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed === "" ? OG_HOME_KEY : trimmed;
}

export function ogImagePath(key: string): string {
  return `/og/${key}.png`;
}

export function ogImageUrl(key: string): string {
  return `${SITE_URL}${ogImagePath(key)}`;
}

export function ogImageAlt(subject: string): string {
  return `تصویر اشتراک‌گذاری تابلو برای ${subject}`;
}

export interface OgImageMetaInput {
  key: string;
  alt: string;
}

/**
 * ⚠️ `twitter:card` is part of this list on purpose: phase 0 downgraded the
 * site-wide default to `summary` because no page had an image to back it.
 * `summary_large_image` is only true where these tags are, so the two must
 * never be written apart.
 */
export function ogImageMeta(input: OgImageMetaInput): Record<string, string>[] {
  const url = ogImageUrl(input.key);
  return [
    { property: "og:image", content: url },
    { property: "og:image:secure_url", content: url },
    { property: "og:image:type", content: OG_IMAGE_TYPE },
    { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
    { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
    { property: "og:image:alt", content: input.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: url },
    { name: "twitter:image:alt", content: input.alt },
  ];
}
