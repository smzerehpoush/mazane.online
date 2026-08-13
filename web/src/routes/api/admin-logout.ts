/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
