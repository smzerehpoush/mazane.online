/**
 * ‎GET/POST /api/admin-posts/$slug‎ — خواندن و ویرایش یک پست در پنل مدیریت
 * (بلیت ۲۲).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-posts-requests.ts` است — همان‌جا
 * که مرز تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostGetResponse,
  adminPostMethodNotAllowed,
  adminPostUpdateResponse,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts/$slug")({
  server: {
    handlers: {
      GET: ({ request, params }) => adminPostGetResponse(request, params.slug),
      POST: ({ request, params }) => adminPostUpdateResponse(request, params.slug),
      ANY: () => adminPostMethodNotAllowed(),
    },
  },
});
