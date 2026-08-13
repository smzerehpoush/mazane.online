/** ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت). */
import { createFileRoute } from "@tanstack/react-router";

import {
  revalidateBlogMethodNotAllowed,
  revalidateBlogResponse,
} from "@/lib/server/revalidate-blog";

export const Route = createFileRoute("/api/revalidate-blog")({
  server: {
    handlers: {
      POST: ({ request }) => revalidateBlogResponse(request),
      ANY: () => revalidateBlogMethodNotAllowed(),
    },
  },
});
