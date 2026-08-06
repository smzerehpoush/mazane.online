/**
 * ‎POST /api/admin-logout‎ — خروج از پنل مدیریت (فراخوان از صفحه‌ی `/admin`).
 *
 * منطق در `lib/server/admin-logout.ts` است — همان‌جا که مرز تست وب می‌سنجدش.
 * این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import { adminLogoutMethodNotAllowed, adminLogoutResponse } from "@/lib/server/admin-logout";

export const Route = createFileRoute("/api/admin-logout")({
  server: {
    handlers: {
      POST: () => adminLogoutResponse(),
      ANY: () => adminLogoutMethodNotAllowed(),
    },
  },
});
