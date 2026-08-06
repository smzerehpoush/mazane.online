/**
 * ‎POST /api/post-view‎ — ثبت بازدید پست بلاگ (فراخوان از مرورگر).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/post-view.ts` است — همان‌جا که مرز
 * تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import { postViewMethodNotAllowed, postViewResponse } from "@/lib/server/post-view";

export const Route = createFileRoute("/api/post-view")({
  server: {
    handlers: {
      POST: ({ request }) => postViewResponse(request),
      ANY: () => postViewMethodNotAllowed(),
    },
  },
});
