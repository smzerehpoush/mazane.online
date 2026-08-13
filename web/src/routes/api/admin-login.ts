/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
