/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
