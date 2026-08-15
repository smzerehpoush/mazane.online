/**
 * ⚠️ There must be no static ‎public/robots.txt‎ file — Nitro serves static
 * assets before the route, which would make this route ineffective. It has
 * been intentionally removed.
 * ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree).
 */
import { createFileRoute } from "@tanstack/react-router";

import { HTML_EDGE_CACHE_CONTROL } from "@/lib/seo/cache-headers";
import { renderRobotsTxt } from "@/lib/seo/robots";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(renderRobotsTxt(), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": HTML_EDGE_CACHE_CONTROL,
          },
        }),
    },
  },
});
