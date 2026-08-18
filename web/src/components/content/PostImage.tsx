import type { ImageAsset } from "@/lib/images";

/**
 * ⚠️ `sizes` is emitted only next to a real `srcset`. Every post published
 * before ticket 78 has one width in the bucket and `image_srcset` null, and
 * a `sizes` attribute on its own would tell the browser about a choice it
 * does not have.
 */
export function PostImage({
  image,
  sizes,
  loading,
  className,
  priority = false,
}: {
  image: ImageAsset;
  sizes: string;
  loading: "lazy" | "eager";
  className: string;
  priority?: boolean;
}) {
  return (
    <img
      src={image.url}
      {...(image.srcset === null ? {} : { srcSet: image.srcset, sizes })}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={loading}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={className}
    />
  );
}
