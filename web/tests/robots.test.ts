/**
 * مرز وب — بلیت ۹: ‎robots.txt‎ (بند ۶.۴ سند معماری).
 *
 * ‎/go/‎ مسیر ریدایرکت درآمدزای داخلی است و باید برای همه‌ی خزنده‌ها بسته
 * باشد؛ بقیه‌ی سایت باز است و سایت‌مپ معرفی می‌شود.
 */
import { describe, expect, it } from "vitest";

import robots from "../app/robots";
import { SITE_URL } from "../lib/site";

describe("robots.txt — بستن /go/ (بند ۶.۴)", () => {
  it("برای همه‌ی خزنده‌ها /go/ بسته و بقیه باز است", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    // دست‌کم یک قاعده‌ی سراسری (*) با Disallow: /go/ — الزام وجودی بند ۶.۴.
    const global = rules.find((rule) => rule.userAgent === "*");
    expect(global).toBeDefined();
    const disallow = Array.isArray(global?.disallow)
      ? global?.disallow
      : [global?.disallow];
    expect(disallow).toContain("/go/");
    const allow = Array.isArray(global?.allow) ? global?.allow : [global?.allow];
    expect(allow).toContain("/");
  });

  it("سایت‌مپ را معرفی می‌کند", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
