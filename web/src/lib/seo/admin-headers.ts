export const ADMIN_NO_INDEX_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function adminHeadersFor(pathname: string): Readonly<Record<string, string>> | null {
  return isAdminPath(pathname) ? ADMIN_NO_INDEX_HEADERS : null;
}

export function applyAdminHeaders(response: Response, pathname: string): Response {
  const headers = adminHeadersFor(pathname);
  if (headers === null) return response;
  try {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  } catch {
    // هدر قفل — عمداً بی‌صدا.
  }
  return response;
}
