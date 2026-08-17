import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListedPlatform } from "../src/lib/prices";
import { setPriceSource } from "../src/lib/prices";
import {
  resetReferralClickSource,
  setReferralClickSource,
  type ReferralClickSource,
} from "../src/lib/referral-clicks";
import { goRedirectResponse } from "../src/lib/server/go-redirect";

const REFERRAL_CODE = "MZN-SECRET-4242";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    website_url: "https://milli.gold",
    referral_url: `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    referral_param: "referralCode",
  },
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    website_url: "https://wallgold.ir",
  },
  { slug: "bihich", name_fa: "بی‌هیچ", data_policy: "ALLOWED" },
];

function seedPlatforms(): void {
  setPriceSource({
    getListedPlatforms: async () => PLATFORMS,
    getSnapshot: async () => null,
    getUpdatedAt: async () => null,
    getInstruments: async () => [],
  });
}

let written: unknown[][] = [];

function spySource(): ReferralClickSource {
  return {
    async increment(...args) {
      written.push(args);
    },
    async read(days) {
      const byDay: Record<string, Record<string, number>> = {};
      for (const day of days) byDay[day] = {};
      return byDay;
    },
  };
}

beforeEach(() => {
  written = [];
  resetReferralClickSource();
  setReferralClickSource(spySource());
});

afterEach(() => {
  resetReferralClickSource();
  vi.restoreAllMocks();
});

describe("GET /go/<slug> — referral redirect", () => {
  it("a platform with referral_url ⟸ 302 to it, with X-Robots-Tag: noindex", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("milli");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("a platform without a referral code ⟸ 302 straight to website_url (codes arrive later)", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("wallgold");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://wallgold.ir");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("unknown slug ⟸ 404", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("hich-vaght-nabude");
    expect(response.status).toBe(404);
  });

  it("a platform with neither referral_url nor website_url ⟸ 404, not an empty redirect", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("bihich");
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("the redirect is temporary (302), not 301 — the destination changes once the referral code arrives", async () => {
    seedPlatforms();
    for (const slug of ["milli", "wallgold"]) {
      const response = await goRedirectResponse(slug);
      expect(response.status).toBe(302);
    }
  });

  it("no response is ever cached — the destination changes once the referral code arrives", async () => {
    seedPlatforms();
    for (const slug of ["milli", "bihich"]) {
      const response = await goRedirectResponse(slug);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("a served redirect is counted once, keyed on the slug", async () => {
    seedPlatforms();
    await goRedirectResponse("milli");
    await goRedirectResponse("milli");
    await goRedirectResponse("wallgold");

    expect(written.map((args) => args[0])).toEqual(["milli", "milli", "wallgold"]);
  });

  it("a 404 is never counted — an unknown route param cannot mint a counter key", async () => {
    seedPlatforms();
    await goRedirectResponse("hich-vaght-nabude");
    await goRedirectResponse("bihich");
    await goRedirectResponse("../../etc/passwd");

    expect(written).toEqual([]);
  });

  it("neither the referral URL nor the referral code ever reaches the store", async () => {
    seedPlatforms();
    for (const slug of ["milli", "wallgold", "bihich", "hich-vaght-nabude"]) {
      await goRedirectResponse(slug);
    }

    const serialized = JSON.stringify(written);
    expect(serialized).not.toContain(REFERRAL_CODE);
    expect(serialized).not.toContain("referralCode");
    expect(serialized).not.toContain("milli.gold");
    expect(serialized).not.toContain("wallgold.ir");
    expect(serialized).not.toContain("http");
  });

  it("a store outage still returns the 302 — the click is lost, the visitor is not", async () => {
    seedPlatforms();
    setReferralClickSource({
      increment: async () => {
        throw new Error("redis down");
      },
      read: async () => {
        throw new Error("redis down");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await goRedirectResponse("milli");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    );
  });

  it("the referral code never ends up in logs", async () => {
    seedPlatforms();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );

    await goRedirectResponse("milli");
    setReferralClickSource({
      increment: async () => {
        throw new Error("redis down");
      },
      read: async () => {
        throw new Error("redis down");
      },
    });
    await goRedirectResponse("milli");

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(REFERRAL_CODE);
      }
    }
  });
});
