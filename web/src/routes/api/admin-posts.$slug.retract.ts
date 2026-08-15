/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostRetractMethodNotAllowed,
  adminPostRetractResponse,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts/$slug/retract")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostRetractResponse(request, params.slug),
      ANY: () => adminPostRetractMethodNotAllowed(),
    },
  },
});
