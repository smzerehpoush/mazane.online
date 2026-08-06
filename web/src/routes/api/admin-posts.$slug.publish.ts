/**
 * ‎POST /api/admin-posts/$slug/publish‎ — انتشار یک پیش‌نویس در پنل مدیریت
 * (بلیت ۲۲).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-posts-requests.ts` است — همان‌جا
 * که مرز تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostPublishMethodNotAllowed,
  adminPostPublishResponse,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts/$slug/publish")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostPublishResponse(request, params.slug),
      ANY: () => adminPostPublishMethodNotAllowed(),
    },
  },
});
