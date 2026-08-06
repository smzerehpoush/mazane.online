/**
 * ‎POST /api/admin-login‎ — ورود به پنل مدیریت (فراخوان از فرم `/admin/login`).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-login.ts` است — همان‌جا که مرز
 * تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import { adminLoginMethodNotAllowed, adminLoginResponse } from "@/lib/server/admin-login";

export const Route = createFileRoute("/api/admin-login")({
  server: {
    handlers: {
      POST: ({ request }) => adminLoginResponse(request),
      ANY: () => adminLoginMethodNotAllowed(),
    },
  },
});
