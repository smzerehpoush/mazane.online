import "@tanstack/react-start/server-only";

import { json, unauthorized } from "./admin-http";
import { hasValidSession } from "./admin-session";
import { getReferralClickReport } from "./referral-click-counter";
import { getListedPlatforms } from "./price-source";
import { REFERRAL_CLICK_WINDOW_DAYS } from "../referral-clicks";

export async function adminReferralClicksGetResponse(request: Request): Promise<Response> {
  if (!hasValidSession(request.headers.get("cookie"))) return unauthorized();

  const [report, platforms] = await Promise.all([
    getReferralClickReport(REFERRAL_CLICK_WINDOW_DAYS),
    getListedPlatforms(),
  ]);

  const names: Record<string, string> = {};
  for (const platform of platforms) names[platform.slug] = platform.name_fa;

  return json({ report, names }, 200);
}

export function adminReferralClicksMethodNotAllowed(): Response {
  return json({ error: "فقط GET" }, 405, { Allow: "GET" });
}
