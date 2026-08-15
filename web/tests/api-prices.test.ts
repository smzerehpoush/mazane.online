import { describe, expect, it } from "vitest";

import { formatToman } from "../src/lib/format";
import type { LivePricesPayload } from "../src/lib/live-update";
import { livePricesResponse } from "../src/lib/server/live-prices";
import { healthyStore, seed, staleIso, storeWithUnknownFee } from "./support/seed";

async function getPayload(): Promise<{ response: Response; payload: LivePricesPayload }> {
  const response = await livePricesResponse();
  return { response, payload: (await response.json()) as LivePricesPayload };
}

describe("GET /api/prices", () => {
  it("responds 200 with Cache-Control: no-store (client consumption only)", async () => {
    seed(healthyStore());
    const { response } = await getPayload();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns exactly the listed platforms — goldika never appears, even though it's in the store", async () => {
    const store = healthyStore();
    seed(store);
    expect(store.snapshots["goldika"]).not.toBeNull();
    const { payload } = await getPayload();
    expect(payload.rows.map((row) => row.platform_slug)).toEqual(["wallgold", "talasea", "milli"]);
  });

  it("each platform's number matches the page's \"price\" — both the raw number and the fa-IR display string", async () => {
    const store = healthyStore();
    seed(store);
    const { payload } = await getPayload();
    const wallgold = payload.rows.find((row) => row.platform_slug === "wallgold");
    expect(wallgold).toMatchObject({
      price_toman: 18611000,
      price_display: formatToman(18611000), // «۱۸٬۶۱۱٬۰۰۰»
      updated_at: store.updatedAt["wallgold"],
    });
    expect(wallgold?.price_display).toBe("۱۸٬۶۱۱٬۰۰۰");
  });

  it("the \"unknown fee\" platform returns a mid-point price — the same number shown on the page", async () => {
    seed(storeWithUnknownFee());
    const { payload } = await getPayload();
    const digikala = payload.rows.find((row) => row.platform_slug === "digikala");
    expect(digikala).toMatchObject({
      price_toman: 18520000,
      price_display: formatToman(18520000),
    });
  });

  it("source outage ⟸ null price and a stale updated_at, not an error", async () => {
    const store = healthyStore();
    const stale = staleIso();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = stale;
    seed(store);
    const { response, payload } = await getPayload();
    expect(response.status).toBe(200);
    const talasea = payload.rows.find((row) => row.platform_slug === "talasea");
    expect(talasea).toEqual({
      platform_slug: "talasea",
      price_toman: null,
      price_display: null,
      updated_at: stale,
    });
  });

  it("generated_at is a valid payload-generation timestamp", async () => {
    seed(healthyStore());
    const before = Date.now();
    const { payload } = await getPayload();
    const generated = Date.parse(payload.generated_at);
    expect(Number.isNaN(generated)).toBe(false);
    expect(generated).toBeGreaterThanOrEqual(before - 1000);
    expect(generated).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
