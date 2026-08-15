/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostPublishMethodNotAllowed,
  adminPostPublishResponse,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts/$slug/publish")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostPublishResponse(request, params.slug),
      ANY: () => adminPostPublishMethodNotAllowed(),
    },
  },
});
