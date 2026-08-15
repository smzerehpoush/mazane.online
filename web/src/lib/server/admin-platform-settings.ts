/**
 * ⚠️ This route never creates or changes any price number —
 * only slug/color/order/link. ⚠️ Chart membership never affects the price
 * table — this route has no access to the price table at all. Real
 * validation of the referral URL (https + same-domain) is in
 * `savePlatformSettings`, not here.
 */
import "@tanstack/react-start/server-only";

import { json, unauthorized } from "./admin-http";
import { hasValidSession } from "./admin-session";
import { loadPlatformSettingsView, savePlatformSettings } from "./platform-settings-admin";
import type { PlatformSettingEntry } from "../platform-settings";

const MAX_BODY_BYTES = 8192;

function requireSession(request: Request): boolean {
  return hasValidSession(request.headers.get("cookie"));
}

export async function adminPlatformSettingsGetResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();

  const { platforms, settings } = await loadPlatformSettingsView();
  return json({ platforms, settings }, 200);
}

function parseEntry(raw: unknown): PlatformSettingEntry {
  if (typeof raw !== "object" || raw === null) throw new Error("bad entry");
  const obj = raw as Record<string, unknown>;

  if (typeof obj["slug"] !== "string" || obj["slug"].length === 0) throw new Error("bad entry");
  if (typeof obj["in_chart"] !== "boolean") throw new Error("bad entry");

  const rawColor = obj["chart_color"];
  if (rawColor !== null && typeof rawColor !== "string") throw new Error("bad entry");

  const rawOrder = obj["chart_order"];
  if (rawOrder !== null && typeof rawOrder !== "number") throw new Error("bad entry");

  const rawReferral = obj["referral_url"];
  if (rawReferral !== null && typeof rawReferral !== "string") throw new Error("bad entry");

  return {
    slug: obj["slug"],
    in_chart: obj["in_chart"],
    chart_color: rawColor ?? null,
    chart_order: rawOrder ?? null,
    referral_url: rawReferral ?? null,
  };
}

export async function adminPlatformSettingsPostResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "بدنه بیش از حد بزرگ است" }, 400);

  let entries: PlatformSettingEntry[];
  try {
    const body: unknown = JSON.parse(raw);
    const rawEntries =
      typeof body === "object" && body !== null
        ? (body as { entries?: unknown }).entries
        : undefined;
    if (!Array.isArray(rawEntries)) throw new Error("bad body");
    entries = rawEntries.map(parseEntry);
  } catch {
    return json({ error: "بدنه نامعتبر است" }, 400);
  }

  const error = await savePlatformSettings(entries);
  if (error !== null) return json({ error }, 400);

  return json({ ok: true }, 200);
}

export function adminPlatformSettingsMethodNotAllowed(): Response {
  return json({ error: "فقط GET/POST" }, 405, { Allow: "GET, POST" });
}
