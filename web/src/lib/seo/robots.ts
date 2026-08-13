import { SITE_URL } from "../site";

export function renderRobotsTxt(siteUrl: string = SITE_URL): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /go/",
    "Disallow: /admin",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}
