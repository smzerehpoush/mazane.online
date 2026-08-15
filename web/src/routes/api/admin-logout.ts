/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { adminLogoutMethodNotAllowed, adminLogoutResponse } from "@/lib/server/admin-logout";

export const Route = createFileRoute("/api/admin-logout")({
  server: {
    handlers: {
      POST: () => adminLogoutResponse(),
      ANY: () => adminLogoutMethodNotAllowed(),
    },
  },
});
