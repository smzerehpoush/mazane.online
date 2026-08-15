/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
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
