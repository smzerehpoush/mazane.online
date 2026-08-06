/**
 * منطق ‎GET/POST /api/admin-platform-settings‎ — تنظیمات نمودار پنل (بلیت ۲۱).
 *
 * جدا از مسیر، تا مرز تست وب بتواند رفتار را با منبع تزریق‌شده بسنجد —
 * همان الگوی `post-view.ts`/`admin-login.ts`.
 *
 * قرارداد:
 *     GET /api/admin-platform-settings
 *     ← 200  {"platforms":[...], "settings":[...]}   نشست معتبر
 *     ← 401  {"error": "..."}                          نشست معتبر نیست
 *
 *     POST /api/admin-platform-settings   {"entries": [{slug, in_chart, chart_color, chart_order}, ...]}
 *     ← 200  {"ok": true}                               ذخیره شد
 *     ← 400  {"error": "..."}                           بدنه/اعتبارسنجی نامعتبر
 *     ← 401  {"error": "..."}                           نشست معتبر نیست
 *     ← 405                                              متد دیگر
 *
 * این مسیر زیر `/admin/*` نیست (بند ۹ قراردادها فقط دو مسیر عمومی/مدیریتی
 * را می‌شناسد)، پس هدرهای `no-store`/`noindex` را خودش مستقیم می‌گذارد —
 * همان دلیل `admin-login.ts` (میان‌افزار سراسری `adminSecurityMiddleware`
 * فقط `isAdminPath` یعنی مسیرهای زیر `/admin` را می‌پوشاند).
 *
 * ⚠️ قاعده‌ی سخت ۱: این مسیر هیچ عدد قیمتی نمی‌سازد یا تغییر نمی‌دهد —
 * فقط اسلاگ/رنگ/ترتیب. ⚠️ قاعده‌ی سخت ۲: عضویت نمودار هرگز روی جدول قیمت
 * اثر نمی‌گذارد — این مسیر اصلاً به جدول قیمت دسترسی ندارد.
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { hasValidSession } from "./admin-session";
import { loadPlatformSettingsView, savePlatformSettings } from "./platform-settings-admin";
import type { PlatformSettingEntry } from "../platform-settings";

/** بدنه‌ی معتبر چند صد بایت است (حداکثر ۶ ردیف)؛ بقیه‌اش سوءاستفاده است. */
const MAX_BODY_BYTES = 8192;

const ADMIN_NO_INDEX_HEADERS = {
  "Cache-Control": NO_STORE,
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ADMIN_NO_INDEX_HEADERS,
      ...extra,
    },
  });
}

function unauthorized(): Response {
  return json({ error: "نشست معتبر نیست" }, 401);
}

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

  return {
    slug: obj["slug"],
    in_chart: obj["in_chart"],
    chart_color: rawColor ?? null,
    chart_order: rawOrder ?? null,
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
