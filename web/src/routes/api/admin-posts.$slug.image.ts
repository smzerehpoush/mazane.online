/**
 * ‎POST /api/admin-posts/$slug/image‎ — آپلود عکس شاخص یک پست در پنل مدیریت
 * (بلیت ۲۴).
 *
 * منطق و دلیل تصمیم‌ها در `lib/server/admin-post-image.ts` است — همان‌جا
 * که مرز تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostImageMethodNotAllowed,
  adminPostImageUploadResponse,
} from "@/lib/server/admin-post-image";

export const Route = createFileRoute("/api/admin-posts/$slug/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostImageUploadResponse(request, params.slug),
      ANY: () => adminPostImageMethodNotAllowed(),
    },
  },
});
