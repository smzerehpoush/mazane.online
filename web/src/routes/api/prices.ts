/**
 * ‎GET /api/prices‎ — نقطه‌ی JSON زنده‌ی به‌روزرسان ۳۰ ثانیه‌ای (بند ۶.۲).
 *
 * منطق و قرارداد shape در `lib/server/live-prices.ts` است — همان‌جا که مرز
 * تست وب می‌سنجدش. این فایل فقط سیم‌کشی مسیر است.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import {
  livePricesMethodNotAllowed,
  livePricesResponse,
} from "@/lib/server/live-prices";

export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      GET: () => livePricesResponse(),
      ANY: () => livePricesMethodNotAllowed(),
    },
  },
});
