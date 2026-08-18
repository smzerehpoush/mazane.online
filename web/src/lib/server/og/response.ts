import "@tanstack/react-start/server-only";

import { OG_IMAGE_TYPE } from "../../og";
import { NO_STORE } from "../../seo/cache-headers";
import { OG_CACHE_TTL_SECONDS, readCachedOgImage, writeCachedOgImage } from "./cache";
import { ogCardFor } from "./card-data";
import { renderOgCard, renderOgFallbackCard } from "./render";

export const OG_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const OG_FILE_SUFFIX = ".png";

export const OG_CACHE_CONTROL = `public, max-age=${OG_CACHE_TTL_SECONDS}, s-maxage=${OG_CACHE_TTL_SECONDS}, stale-while-revalidate=3600, stale-if-error=86400`;

const FALLBACK_CACHE_CONTROL = "public, max-age=60, s-maxage=60";

/**
 * ⚠️ The route segment is `$key`, not `$key.png`: the extension is part of the
 * URL that Telegram and WhatsApp fetch and it is stripped here. A request
 * without it is a 404, so `/og/home` never becomes a second URL for the same
 * image.
 */
export function ogKeyFromParam(param: string): string | null {
  if (!param.endsWith(OG_FILE_SUFFIX)) return null;
  const key = param.slice(0, -OG_FILE_SUFFIX.length);
  return OG_KEY_PATTERN.test(key) ? key : null;
}

function imageResponse(image: Buffer, cacheControl: string): Response {
  return new Response(new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": OG_IMAGE_TYPE,
      "Content-Length": String(image.byteLength),
      "Cache-Control": cacheControl,
    },
  });
}

function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": NO_STORE } });
}

/**
 * ⚠️ Never a 5xx. A missing price degrades to a card without a number, a
 * renderer failure degrades to the text-free card, and only an unknown key
 * answers 404 — which is simply «no image», the behaviour before this route
 * existed.
 */
export async function ogImageResponse(param: string): Promise<Response> {
  const key = ogKeyFromParam(param);
  if (key === null) return notFound();

  const cached = await readCachedOgImage(key);
  if (cached !== null) return imageResponse(cached, OG_CACHE_CONTROL);

  let card = null;
  try {
    card = await ogCardFor(key);
  } catch (error) {
    console.error(`og card data failed for «${key}»`, error);
  }
  if (card === null) return notFound();

  try {
    const image = await renderOgCard(card);
    await writeCachedOgImage(key, image);
    return imageResponse(image, OG_CACHE_CONTROL);
  } catch (error) {
    console.error(`og card render failed for «${key}»`, error);
  }

  try {
    return imageResponse(await renderOgFallbackCard(), FALLBACK_CACHE_CONTROL);
  } catch (error) {
    console.error("og fallback card render failed", error);
    return notFound();
  }
}

export function ogImageMethodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, HEAD", "Cache-Control": NO_STORE },
  });
}
