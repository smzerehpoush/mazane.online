/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { calcEventMethodNotAllowed, calcEventResponse } from "@/lib/server/calc-event";

export const Route = createFileRoute("/api/calc-event")({
  server: {
    handlers: {
      POST: ({ request }) => calcEventResponse(request),
      ANY: () => calcEventMethodNotAllowed(),
    },
  },
});
