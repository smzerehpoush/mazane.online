/**
 * ‎GET/POST /api/admin-platform-settings‎ — تنظیمات نمودار پنل مدیریت (بلیت ۲۱).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-platform-settings.ts` است —
 * همان‌جا که مرز تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPlatformSettingsGetResponse,
  adminPlatformSettingsMethodNotAllowed,
  adminPlatformSettingsPostResponse,
} from "@/lib/server/admin-platform-settings";

export const Route = createFileRoute("/api/admin-platform-settings")({
  server: {
    handlers: {
      GET: ({ request }) => adminPlatformSettingsGetResponse(request),
      POST: ({ request }) => adminPlatformSettingsPostResponse(request),
      ANY: () => adminPlatformSettingsMethodNotAllowed(),
    },
  },
});
