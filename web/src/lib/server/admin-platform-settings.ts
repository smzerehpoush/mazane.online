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
import { loadPlatformProfiles, savePlatformProfiles } from "./platform-profiles-admin";
import {
  KYC_LEVELS,
  MOBILE_APPS,
  PAYMENT_METHODS,
  emptyProfile,
  type FaqItem,
  type KycLevel,
  type MobileApp,
  type PaymentMethod,
  type PlatformProfileEntry,
} from "../platform-profile";
import type { PlatformSettingEntry } from "../platform-settings";

/**
 * ⚠️ Raised well above the chart settings' original 8 KB because the profile
 * carries Persian prose (pros/cons and a per-platform FAQ) for every platform.
 * The real per-field limits live in `validatePlatformProfiles`; this is only
 * the coarse guard against an absurd body.
 */
const MAX_BODY_BYTES = 256 * 1024;

function requireSession(request: Request): boolean {
  return hasValidSession(request.headers.get("cookie"));
}

export async function adminPlatformSettingsGetResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();

  const { platforms, settings } = await loadPlatformSettingsView();
  const profiles = await loadPlatformProfiles(platforms.map((platform) => platform.slug));
  return json({ platforms, settings, profiles }, 200);
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

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("bad profile");
  return value;
}

function optionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("bad profile");
  }
  return parsed;
}

function member<T extends string>(allowed: readonly T[], value: unknown): T | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error("bad profile");
  return value as T;
}

function stringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("bad profile");
  return value.map((item) => {
    if (typeof item !== "string") throw new Error("bad profile");
    return item;
  });
}

function faqList(value: unknown): FaqItem[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("bad profile");
  return value.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("bad profile");
    const record = item as Record<string, unknown>;
    if (typeof record["question_fa"] !== "string" || typeof record["answer_fa"] !== "string") {
      throw new Error("bad profile");
    }
    return { question_fa: record["question_fa"], answer_fa: record["answer_fa"] };
  });
}

function parseProfile(raw: unknown): PlatformProfileEntry {
  if (typeof raw !== "object" || raw === null) throw new Error("bad profile");
  const obj = raw as Record<string, unknown>;
  if (typeof obj["slug"] !== "string" || obj["slug"].length === 0) throw new Error("bad profile");

  const methods = stringList(obj["payment_methods"]).map((method) => {
    const parsed = member<PaymentMethod>(PAYMENT_METHODS, method);
    if (parsed === null) throw new Error("bad profile");
    return parsed;
  });

  return {
    ...emptyProfile(),
    slug: obj["slug"],
    payment_methods: methods,
    kyc_level: member<KycLevel>(KYC_LEVELS, obj["kyc_level"]),
    mobile_app: member<MobileApp>(MOBILE_APPS, obj["mobile_app"]),
    delivery_cost_fa: optionalString(obj["delivery_cost_fa"]),
    min_buy_toman: optionalPositiveInt(obj["min_buy_toman"]),
    min_sell_toman: optionalPositiveInt(obj["min_sell_toman"]),
    pros_fa: stringList(obj["pros_fa"]),
    cons_fa: stringList(obj["cons_fa"]),
    faq: faqList(obj["faq"]),
  };
}

export async function adminPlatformSettingsPostResponse(request: Request): Promise<Response> {
  if (!requireSession(request)) return unauthorized();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "بدنه بیش از حد بزرگ است" }, 400);

  let entries: PlatformSettingEntry[];
  let profiles: PlatformProfileEntry[];
  try {
    const body: unknown = JSON.parse(raw);
    const record =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const rawEntries = record["entries"];
    if (!Array.isArray(rawEntries)) throw new Error("bad body");
    entries = rawEntries.map(parseEntry);

    const rawProfiles = record["profiles"];
    if (rawProfiles === undefined || rawProfiles === null) {
      profiles = [];
    } else if (Array.isArray(rawProfiles)) {
      profiles = rawProfiles.map(parseProfile);
    } else {
      throw new Error("bad body");
    }
  } catch {
    return json({ error: "بدنه نامعتبر است" }, 400);
  }

  const error = await savePlatformSettings(entries);
  if (error !== null) return json({ error }, 400);

  if (profiles.length > 0) {
    const listedSlugs = new Set(entries.map((entry) => entry.slug));
    const profileError = await savePlatformProfiles(profiles, listedSlugs);
    if (profileError !== null) return json({ error: profileError }, 400);
  }

  return json({ ok: true }, 200);
}

export function adminPlatformSettingsMethodNotAllowed(): Response {
  return json({ error: "فقط GET/POST" }, 405, { Allow: "GET, POST" });
}
