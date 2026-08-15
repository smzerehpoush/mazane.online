export const HTML_EDGE_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400";

export const NO_STORE = "no-store";

export interface CachePolicyInput {
  pathname: string;
  status: number;
  contentType: string | null;
  hasCacheControl: boolean;
  isServerFn: boolean;
}

function isNeverCached(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/go" ||
    pathname.startsWith("/go/")
  );
}

export function edgeCacheControlFor(input: CachePolicyInput): string | null {
  if (input.hasCacheControl) return null;
  if (input.isServerFn) return NO_STORE;
  if (isNeverCached(input.pathname)) return NO_STORE;
  if (input.status === 304) return null;
  if (input.status !== 200) return NO_STORE;
  if ((input.contentType ?? "").includes("text/html")) return HTML_EDGE_CACHE_CONTROL;
  return null;
}

export function applyEdgeCacheControl(
  response: Response,
  input: Omit<CachePolicyInput, "status" | "contentType" | "hasCacheControl">,
): Response {
  const value = edgeCacheControlFor({
    ...input,
    status: response.status,
    contentType: response.headers.get("content-type"),
    hasCacheControl: response.headers.has("cache-control"),
  });
  if (value === null) return response;
  try {
    response.headers.set("cache-control", value);
  } catch {
    // Locked header — intentionally silent.
  }
  return response;
}
