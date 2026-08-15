/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostsCreateResponse,
  adminPostsListResponse,
  adminPostsMethodNotAllowed,
} from "@/lib/server/admin-posts-requests";

export const Route = createFileRoute("/api/admin-posts")({
  server: {
    handlers: {
      GET: ({ request }) => adminPostsListResponse(request),
      POST: ({ request }) => adminPostsCreateResponse(request),
      ANY: () => adminPostsMethodNotAllowed(),
    },
  },
});
