const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

export interface HeadLink {
  rel: string;
  href: string;
}

export function imageOriginOf(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname === "") return null;
  return url.origin;
}

export function imagePreconnectLinks(origin: string | null): HeadLink[] {
  if (origin === null) return [];
  return [
    { rel: "preconnect", href: origin },
    { rel: "dns-prefetch", href: origin },
  ];
}

export function configuredImageOrigin(): string | null {
  if (!import.meta.env.SSR) return null;
  return imageOriginOf(process.env["TABLO_ARVAN_S3_ENDPOINT"]);
}
