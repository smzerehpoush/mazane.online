/**
 * متن ‎robots.txt‎ — بند ۶.۴ سند معماری.
 *
 * ‎/go/‎ مسیر ریدایرکت درآمدزای داخلی است و برای همه‌ی خزنده‌ها بسته می‌ماند:
 * لینک معرف نه ایندکس می‌خواهد نه اعتبار می‌گیرد. لایه‌ی دوم همین قاعده،
 * هدر ‎X-Robots-Tag: noindex‎ روی خود پاسخ ‎/go/‎ است (دفاع در عمق برای
 * خزنده‌ای که robots را از کش قدیمی دارد).
 *
 * تابع خالص است — نه به فریم‌ورک وابسته است نه به منبع داده — تا مسیر
 * ‎src/routes/robots[.]txt.ts‎ فقط پوسته‌ی نازکش باشد و همین قاعده مستقیماً
 * تست شود.
 */
import { SITE_URL } from "../site";

/**
 * متن کامل ‎robots.txt‎. نشانی سایت‌مپ **مطلق** است — استاندارد robots
 * نشانی نسبی را برای ‎Sitemap:‎ نمی‌پذیرد.
 */
export function renderRobotsTxt(siteUrl: string = SITE_URL): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /go/",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}
