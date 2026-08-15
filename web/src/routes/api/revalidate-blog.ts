/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
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
