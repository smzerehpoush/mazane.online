/**
 * ⚠️ No log here is allowed to print the destination: `referral_url`
 * carries the referral code, and the code must not leak into logs (or any
 * output other than the `Location` header).
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { getListedPlatforms } from "./price-source";

const NOINDEX_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": NO_STORE,
} as const;

export async function goRedirectResponse(slug: string): Promise<Response> {
  const platforms = await getListedPlatforms();
  const platform = platforms.find((item) => item.slug === slug) ?? null;
  const destination = platform?.referral_url ?? platform?.website_url ?? null;
  if (destination === null) {
    return new Response(null, { status: 404, headers: { ...NOINDEX_HEADERS } });
  }
  return new Response(null, {
    status: 302,
    headers: { ...NOINDEX_HEADERS, Location: destination },
  });
}

export function goMethodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { ...NOINDEX_HEADERS, Allow: "GET, HEAD" },
  });
}
