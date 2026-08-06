/**
 * صفحه‌ی معیارهای پیشنهاد سردبیر (بلیت ۶ — تصمیم ۹: تفکیک تبلیغ و تحریریه).
 *
 * پیشنهادی که معیارش منتشر نشده باشد تحریریه نیست؛ این صفحه همان معیار را
 * علنی می‌کند: کمترین هزینه‌ی رفت‌وبرگشت میان سکوهایی با کارمزد API و
 * خریدوفروش باز. صفحه ایستاست — هیچ استوری لازم ندارد.
 *
 * ⚠️ امروز هیچ جزء «پیشنهاد سردبیر» ای روی صفحه‌ی اصلی نیست (جایگاه تبلیغ در
 * طرح تازه جایی ندارد)، ولی صفحه‌ی معیار طبق تصمیم ۹ حذف نمی‌شود و در ناوبری
 * سرصفحه هم هست — پس متن و حضورش در سایت‌مپ همچنان دروازه دارند.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DarbarePishnahad,
  darbarePishnahadHead,
} from "../src/routes/darbare-pishnahad";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { nav } from "../src/lib/site-content";

describe("صفحه‌ی معیارهای پیشنهاد سردبیر", () => {
  it("معیار انتخاب را صریح اعلام می‌کند", () => {
    const html = renderToStaticMarkup(<DarbarePishnahad />);
    expect(html).toContain("پیشنهاد سردبیر");
    // معیار: کمترین رفت‌وبرگشت، فقط کارمزد API، فقط خریدوفروش باز.
    expect(html).toContain("کمترین هزینه‌ی رفت‌وبرگشت");
    expect(html).toContain("API");
    expect(html).toContain("باز");
  });

  it("تفکیک تبلیغ و تحریریه را اعلام می‌کند: پیشنهاد فروخته نمی‌شود", () => {
    const html = renderToStaticMarkup(<DarbarePishnahad />);
    expect(html).toContain("فروخته نمی‌شود");
    expect(html).toContain("تبلیغ");
  });

  it("canonical تخت لاتین و BreadcrumbList دارد (بند ۶.۵)", () => {
    const head = darbarePishnahadHead();
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/darbare-pishnahad`,
    });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
  });

  it("در سایت‌مپ هست (محتوای ایستا، بدون lastmod قیمتی)", () => {
    const entries = buildSitemapEntries({ posts: [], instruments: [], platforms: [] });
    const entry = entries.find((item) => item.path === "/darbare-pishnahad");
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });

  it("از ناوبری سرصفحه در دسترس است — صفحه‌ی یتیم نمی‌ماند", () => {
    expect(nav.map((item) => item.href)).toContain("/darbare-pishnahad");
  });
});
