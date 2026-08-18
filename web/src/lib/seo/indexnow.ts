import { SITE_URL } from "../site";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const NEVER_SUBMITTED = ["/api/", "/go/", "/admin", "/sitemap.xml", "/robots.txt"];

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export interface IndexNowPayloadOptions {
  key: string | undefined;
  siteUrl?: string;
}

export function isSubmittablePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return !NEVER_SUBMITTED.some((prefix) => path.startsWith(prefix));
}

export function indexNowKeyLocation(key: string, siteUrl: string = SITE_URL): string {
  return `${siteUrl}/${key}.txt`;
}

/**
 * ⚠️ Setting `TABLO_INDEXNOW_KEY` is only half of the setup: IndexNow rejects
 * every submission unless the very same key is also readable as plain text at
 * `<site>/<key>.txt`. Nothing in this repository can verify that the file is
 * up — the steps are in `ops/RUNBOOK.md` section 14.
 */
export function buildIndexNowPayload(
  paths: readonly string[],
  options: IndexNowPayloadOptions,
): IndexNowPayload | null {
  const key = (options.key ?? "").trim();
  if (!KEY_PATTERN.test(key)) return null;

  const siteUrl = options.siteUrl ?? SITE_URL;
  const urlList = [...new Set(paths.filter(isSubmittablePath))].map((path) => `${siteUrl}${path}`);
  if (urlList.length === 0) return null;

  return {
    host: new URL(siteUrl).host,
    key,
    keyLocation: indexNowKeyLocation(key, siteUrl),
    urlList,
  };
}
