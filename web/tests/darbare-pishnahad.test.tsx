/**
 * صفحه‌ی معیارهای پیشنهاد سردبیر (بلیت ۶ — تصمیم ۹: تفکیک تبلیغ و تحریریه).
 *
 * پیشنهادی که معیارش منتشر نشده باشد تحریریه نیست؛ این صفحه همان معیار را
 * علنی می‌کند: کمترین هزینه‌ی رفت‌وبرگشت میان سکوهایی با کارمزد API و
 * خریدوفروش باز. صفحه ایستاست — هیچ استوری لازم ندارد.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import DarbarePishnahad from "../app/darbare-pishnahad/page";
import sitemap from "../app/sitemap";
import { setBlogSource } from "../lib/blog";
import { setPriceSource } from "../lib/prices";
import { SITE_URL } from "../lib/site";

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

  it("در سایت‌مپ هست (محتوای ایستا، بدون lastmod قیمتی)", async () => {
    setBlogSource({ listPosts: async () => [], getPost: async () => null });
    // سایت‌مپ از بلیت ۷ منبع قیمت را هم می‌خواند — خالی تزریق تا ردیس load نشود.
    setPriceSource({
      getListedPlatforms: async () => [],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [],
    });
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`${SITE_URL}/darbare-pishnahad`);
  });
});
