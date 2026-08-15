/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { adminLoginMethodNotAllowed, adminLoginResponse } from "@/lib/server/admin-login";

export const Route = createFileRoute("/api/admin-login")({
  server: {
    handlers: {
      POST: ({ request }) => adminLoginResponse(request),
      ANY: () => adminLoginMethodNotAllowed(),
    },
  },
});
