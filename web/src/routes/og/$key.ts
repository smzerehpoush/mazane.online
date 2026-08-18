/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { ogImageMethodNotAllowed, ogImageResponse } from "@/lib/server/og/response";

export const Route = createFileRoute("/og/$key")({
  server: {
    handlers: {
      GET: ({ params }) => ogImageResponse(params.key),
      ANY: () => ogImageMethodNotAllowed(),
    },
  },
});
