/**
 * ‎GET/POST /api/admin-posts‎ — فهرست و ساخت پست در پنل مدیریت (بلیت ۲۲).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-posts-requests.ts` است — همان‌جا
 * که مرز تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostsCreateResponse,
  adminPostsListResponse,
  adminPostsMethodNotAllowed,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts")({
  server: {
    handlers: {
      GET: ({ request }) => adminPostsListResponse(request),
      POST: ({ request }) => adminPostsCreateResponse(request),
      ANY: () => adminPostsMethodNotAllowed(),
    },
  },
});
