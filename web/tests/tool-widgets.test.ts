import { describe, expect, it } from "vitest";

import { cheapestView } from "../src/components/tablo/ToolWidgets";
import type { RailSource } from "../src/lib/dashboard";
import type { LiveDashboardSource } from "../src/lib/live-update";

function source(slug: string, name: string, priceToman: number | null): RailSource {
  return {
    slug,
    name,
    color: "#123456",
    priceToman,
    priceDisplay: null,
    railPercent: null,
    stemLong: false,
    href: `/go/${slug}`,
    ariaLabel: name,
    sparkline: { line: null, area: null },
    updatedAt: null,
    priceFromHistory: false,
  };
}

function live(slug: string, priceToman: number | null): LiveDashboardSource {
  return {
    slug,
    price_toman: priceToman,
    price_display: null,
    rail_percent: null,
    stem_long: false,
    updated_at: null,
  };
}

describe("cheapestView", () => {
  it("names the lowest-priced platform and measures the spread up to the highest", () => {
    const view = cheapestView(
      [source("milli", "میلی", 19_700_000), source("talasea", "طلاسی", 19_500_000)],
      null,
    );

    expect(view.name).toBe("طلاسی");
    expect(view.priceDisplay).toBe("۱۹٬۵۰۰٬۰۰۰");
    expect(view.spreadDisplay).toBe("۲۰۰٬۰۰۰");
  });

  it("skips a platform that has no price rather than treating it as free", () => {
    const view = cheapestView(
      [source("milli", "میلی", 19_700_000), source("daric", "داریک", null)],
      null,
    );

    expect(view.name).toBe("میلی");
    expect(view.spreadDisplay).toBeNull();
  });

  it("reports nothing at all when no platform has a price", () => {
    const view = cheapestView([source("daric", "داریک", null)], null);

    expect(view).toEqual({ name: null, priceDisplay: null, spreadDisplay: null });
  });

  it("leaves the spread out when only one platform is priced", () => {
    const view = cheapestView([source("milli", "میلی", 19_700_000)], null);

    expect(view.name).toBe("میلی");
    expect(view.priceDisplay).toBe("۱۹٬۷۰۰٬۰۰۰");
    expect(view.spreadDisplay).toBeNull();
  });

  /**
   * ⚠️ The whole reason the live payload is threaded in: the rail below this
   * widget is patched live, so a widget stuck on the loader snapshot would
   * name a different "cheapest" than the axis on the same screen.
   */
  it("prefers the live price over the loader snapshot, which can change the winner", () => {
    const sources = [source("milli", "میلی", 19_700_000), source("talasea", "طلاسی", 19_500_000)];

    expect(cheapestView(sources, null).name).toBe("طلاسی");
    expect(cheapestView(sources, [live("milli", 19_100_000)]).name).toBe("میلی");
  });

  it("falls back to the snapshot price for a platform the live payload omits", () => {
    const view = cheapestView(
      [source("milli", "میلی", 19_700_000), source("talasea", "طلاسی", 19_500_000)],
      [live("milli", 19_800_000)],
    );

    expect(view.name).toBe("طلاسی");
    expect(view.spreadDisplay).toBe("۳۰۰٬۰۰۰");
  });
});
