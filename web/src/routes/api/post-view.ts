/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
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
