/**
 * ⚠️ This file deliberately has **only** the `server` option and no `component`:
 * TanStack recognizes such a route as "server-only" and prunes it entirely
 * from the client route tree — which is why importing from `lib/server/*`
 * (and hence `ioredis`) here is safe. Adding any other option breaks this guarantee.
 */
import { createFileRoute } from "@tanstack/react-router";

import { goMethodNotAllowed, goRedirectResponse } from "@/lib/server/go-redirect";

export const Route = createFileRoute("/go/$slug")({
  server: {
    handlers: {
      GET: ({ params }) => goRedirectResponse(params.slug),
      ANY: () => goMethodNotAllowed(),
    },
  },
});
