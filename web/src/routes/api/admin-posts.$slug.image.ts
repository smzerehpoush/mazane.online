/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostImageMethodNotAllowed,
  adminPostImageUploadResponse,
} from "@/lib/server/admin-post-image";

export const Route = createFileRoute("/api/admin-posts/$slug/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostImageUploadResponse(request, params.slug),
      ANY: () => adminPostImageMethodNotAllowed(),
    },
  },
});
