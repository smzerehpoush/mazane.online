import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SekehPage, sekehHead } from "../src/routes/sekeh";
import type { SekehPageData } from "../src/lib/sekeh-data";
import { SITE_URL } from "../src/lib/site";
import { nav } from "../src/lib/site-content";

const DATA: SekehPageData = {
  generated_at: "2026-08-15T20:17:15.475Z",
  coins: [
    {
      key: "emami",
      label: "سکه امامی",
      instrument: "SEKEH_EMAMI_TOMAN",
      priceToman: 189500000,
      priceDisplay: "۱۸۹٬۵۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
    {
      key: "half",
      label: "نیم سکه",
      instrument: "SEKEH_HALF_TOMAN",
      priceToman: 96000000,
      priceDisplay: "۹۶٬۰۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
    {
      key: "quarter",
      label: "ربع سکه",
      instrument: "SEKEH_QUARTER_TOMAN",
      priceToman: 52500000,
      priceDisplay: "۵۲٬۵۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
  ],
};

describe("coin price page", () => {
  it("renders all coin prices in the server-rendered HTML", () => {
    const html = renderToStaticMarkup(<SekehPage data={DATA} />);
    expect(html).toContain("قیمت سکه امامی، نیم سکه و ربع سکه");
    expect(html).toContain("سکه امامی");
    expect(html).toContain("نیم سکه");
    expect(html).toContain("ربع سکه");
    expect(html).toContain("۱۸۹٬۵۰۰٬۰۰۰");
    expect(html).toContain("۹۶٬۰۰۰٬۰۰۰");
    expect(html).toContain("۵۲٬۵۰۰٬۰۰۰");
    expect(html).toContain("تومان");
  });

  it("explains the coin types without naming the upstream source", () => {
    const html = renderToStaticMarkup(<SekehPage data={DATA} />);
    expect(html).toContain("حباب");
    expect(html).toContain("نقدشوندگی");
    expect(html).not.toContain("tala.ir");
    expect(html).not.toContain("طلا دات‌آی‌آر");
  });

  it("has a canonical URL and breadcrumb JSON-LD", () => {
    const head = sekehHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/sekeh` });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
    expect(head.scripts?.[0]?.children).toContain(`${SITE_URL}/sekeh`);
  });

  it("is reachable from the header nav", () => {
    expect(nav).toContainEqual({ label: "قیمت سکه", href: "/sekeh" });
  });
});
