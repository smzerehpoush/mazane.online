/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostGetResponse,
  adminPostMethodNotAllowed,
  adminPostUpdateResponse,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts/$slug")({
  server: {
    handlers: {
      GET: ({ request, params }) => adminPostGetResponse(request, params.slug),
      POST: ({ request, params }) => adminPostUpdateResponse(request, params.slug),
      ANY: () => adminPostMethodNotAllowed(),
    },
  },
});
