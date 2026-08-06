/**
 * ‎POST /api/revalidate-blog‎ — قلاب انتشار محتوا (مصرف‌کننده: صف انتشار).
 *
 * منطق، قرارداد فراخوانی و توضیح اینکه «بازتولید» در تنکستک استارت چه
 * معنایی دارد، در `lib/server/revalidate-blog.ts` است — همان‌جا که مرز تست
 * وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  revalidateBlogMethodNotAllowed,
  revalidateBlogResponse,
} from "@/lib/server/revalidate-blog";

export const Route = createFileRoute("/api/revalidate-blog")({
  server: {
    handlers: {
      POST: ({ request }) => revalidateBlogResponse(request),
      ANY: () => revalidateBlogMethodNotAllowed(),
    },
  },
});
