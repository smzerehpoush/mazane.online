/**
 * ‎GET /go/<slug>‎ — ریدایرکت لینک معرف (بند ۱۳، تصمیم ۲۱).
 *
 * منطق و دلیل هر تصمیم (۳۰۲ نه ۳۰۱، noindex، ممنوعیت لاگ کد معرف) در
 * `lib/server/go-redirect.ts` است — همان‌جا که مرز تست وب می‌سنجدش.
 *
 * ⚠️ این فایل عمداً **فقط** گزینه‌ی `server` دارد و هیچ `component`ی: تنکستک
 * چنین مسیری را «server-only» می‌شناسد و کاملاً از درخت مسیر کلاینت هرس
 * می‌کند — به همین دلیل import از `lib/server/*` (و در نتیجه `ioredis`)
 * اینجا بی‌خطر است. افزودن هر گزینه‌ی دیگری این تضمین را می‌شکند.
 */
import { createFileRoute } from "@tanstack/react-router";

import { goMethodNotAllowed, goRedirectResponse } from "@/lib/server/go-redirect";

export const Route = createFileRoute("/go/$slug")({
  server: {
    handlers: {
      GET: ({ params }) => goRedirectResponse(params.slug),
      ANY: () => goMethodNotAllowed(),
    },
  },
});
