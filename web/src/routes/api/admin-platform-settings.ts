/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPlatformSettingsGetResponse,
  adminPlatformSettingsMethodNotAllowed,
  adminPlatformSettingsPostResponse,
} from "@/lib/server/admin-platform-settings";

export const Route = createFileRoute("/api/admin-platform-settings")({
  server: {
    handlers: {
      GET: ({ request }) => adminPlatformSettingsGetResponse(request),
      POST: ({ request }) => adminPlatformSettingsPostResponse(request),
      ANY: () => adminPlatformSettingsMethodNotAllowed(),
    },
  },
});
