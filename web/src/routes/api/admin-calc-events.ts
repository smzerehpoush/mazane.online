/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminCalcEventsGetResponse,
  adminCalcEventsMethodNotAllowed,
} from "@/lib/server/admin-calc-events";

export const Route = createFileRoute("/api/admin-calc-events")({
  server: {
    handlers: {
      GET: ({ request }) => adminCalcEventsGetResponse(request),
      ANY: () => adminCalcEventsMethodNotAllowed(),
    },
  },
});
