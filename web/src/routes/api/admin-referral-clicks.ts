/** ⚠️ Only the `server` option — same reason as `go/$slug.ts` (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import {
  adminReferralClicksGetResponse,
  adminReferralClicksMethodNotAllowed,
} from "@/lib/server/admin-referral-clicks";

export const Route = createFileRoute("/api/admin-referral-clicks")({
  server: {
    handlers: {
      GET: ({ request }) => adminReferralClicksGetResponse(request),
      ANY: () => adminReferralClicksMethodNotAllowed(),
    },
  },
});
