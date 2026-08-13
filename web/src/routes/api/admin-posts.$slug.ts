/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
