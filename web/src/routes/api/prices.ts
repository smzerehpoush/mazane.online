/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
