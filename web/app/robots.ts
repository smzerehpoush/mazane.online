/**
 * ‎robots.txt‎ — بلیت ۹ (بند ۶.۴ سند معماری).
 *
 * ‎/go/‎ مسیر ریدایرکت درآمدزای داخلی است و برای همه‌ی خزنده‌ها بسته
 * می‌ماند (لینک معرف نه ایندکس می‌خواهد نه اعتبار می‌گیرد — لایه‌ی دومش
 * ‎X-Robots-Tag: noindex‎ خود پاسخ /go/ است). بقیه‌ی سایت باز است و
 * سایت‌مپ معرفی می‌شود.
 */
import type { MetadataRoute } from "next";

import { SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/go/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
