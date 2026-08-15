/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { postViewMethodNotAllowed, postViewResponse } from "@/lib/server/post-view";

export const Route = createFileRoute("/api/post-view")({
  server: {
    handlers: {
      POST: ({ request }) => postViewResponse(request),
      ANY: () => postViewMethodNotAllowed(),
    },
  },
});
