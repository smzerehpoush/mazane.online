/**
 * ⚠️ فایل ایستای ‎public/robots.txt‎ باید نبوده باشد — نیترو دارایی ایستا را
 * پیش از مسیر سرو می‌کند و این مسیر را بی‌اثر می‌کرد. عمداً حذف شده است.
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
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
