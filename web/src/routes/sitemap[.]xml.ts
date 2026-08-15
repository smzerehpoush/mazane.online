/** ⚠️ Only the `server` option — same reason as ‎go/$slug.ts‎ (pruned from the client tree). */
import { createFileRoute } from "@tanstack/react-router";

import { HTML_EDGE_CACHE_CONTROL, NO_STORE } from "@/lib/seo/cache-headers";
import { buildSitemapEntries, renderSitemapXml } from "@/lib/seo/sitemap";
import { listPublishedPostsStrict } from "@/lib/server/blog-source";
import { getInstruments, getListedPlatforms } from "@/lib/server/price-source";

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [instruments, platforms] = await Promise.all([
          getInstruments(),
          getListedPlatforms(),
        ]);
        let posts;
        try {
          posts = await listPublishedPostsStrict();
        } catch (error) {
          console.error("blog source unavailable; refusing a truncated sitemap", error);
          return new Response("", {
            status: 503,
            headers: { "Content-Type": XML_CONTENT_TYPE, "Cache-Control": NO_STORE },
          });
        }
        const xml = renderSitemapXml(buildSitemapEntries({ posts, instruments, platforms }));
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": XML_CONTENT_TYPE,
            "Cache-Control": HTML_EDGE_CACHE_CONTROL,
          },
        });
      },
    },
  },
});
