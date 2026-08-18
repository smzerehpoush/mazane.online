/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminPostImageDeleteResponse,
  adminPostImageMethodNotAllowed,
  adminPostImageUploadResponse,
} from "@/lib/server/admin-post-image";

export const Route = createFileRoute("/api/admin-posts/$slug/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => adminPostImageUploadResponse(request, params.slug),
      DELETE: ({ request, params }) => adminPostImageDeleteResponse(request, params.slug),
      ANY: () => adminPostImageMethodNotAllowed(),
    },
  },
});
