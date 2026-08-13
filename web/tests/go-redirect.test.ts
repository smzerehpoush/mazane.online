import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListedPlatform } from "../src/lib/prices";
import { setPriceSource } from "../src/lib/prices";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /go/<slug> — ریدایرکت معرف", () => {
  it("سکوی دارای referral_url ⟸ ۳۰۲ به همان، با X-Robots-Tag: noindex", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("milli");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("سکوی بدون کد معرف ⟸ ۳۰۲ مستقیم به website_url (کدها بعداً می‌رسند)", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("wallgold");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://wallgold.ir");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("اسلاگ ناشناخته ⟸ ۴۰۴", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("hich-vaght-nabude");
    expect(response.status).toBe(404);
  });

  it("سکوی بدون referral_url و بدون website_url ⟸ ۴۰۴، نه ریدایرکت خالی", async () => {
    seedPlatforms();
    const response = await goRedirectResponse("bihich");
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("ریدایرکت موقتی است (۳۰۲) نه ۳۰۱ — مقصد با رسیدن کد معرف عوض می‌شود", async () => {
    seedPlatforms();
    for (const slug of ["milli", "wallgold"]) {
      const response = await goRedirectResponse(slug);
      expect(response.status).toBe(302);
    }
  });

  it("هیچ پاسخی کش نمی‌شود — مقصد با رسیدن کد معرف عوض می‌شود", async () => {
    seedPlatforms();
    for (const slug of ["milli", "bihich"]) {
      const response = await goRedirectResponse(slug);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("کد معرف هرگز وارد لاگ نمی‌شود", async () => {
    seedPlatforms();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );

    await goRedirectResponse("milli");

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(REFERRAL_CODE);
      }
    }
  });
});
