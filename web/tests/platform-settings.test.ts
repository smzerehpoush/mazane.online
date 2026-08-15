import { describe, expect, it } from "vitest";

import {
  MAX_CHART_PLATFORMS,
  MIN_CHART_PLATFORMS,
  isValidChartColor,
  isValidReferralUrl,
  normalizePlatformSettings,
  validatePlatformSettings,
  validateReferralUrls,
  type PlatformOption,
  type PlatformSettingEntry,
} from "../src/lib/platform-settings";

const LISTED = new Set(["wallgold", "talasea", "milli", "tlyn"]);

function entry(
  slug: string,
  in_chart: boolean,
  chart_color: string | null = null,
  chart_order: number | null = null,
  referral_url: string | null = null,
): PlatformSettingEntry {
  return { slug, in_chart, chart_color, chart_order, referral_url };
}

describe("isValidChartColor", () => {
  it("accepts #rrggbb in upper or lower case", () => {
    expect(isValidChartColor("#1d6fe0")).toBe(true);
    expect(isValidChartColor("#1D6FE0")).toBe(true);
  });

  it("rejects a malformed shape", () => {
    expect(isValidChartColor("1d6fe0")).toBe(false);
    expect(isValidChartColor("#1d6f")).toBe(false);
    expect(isValidChartColor("red")).toBe(false);
  });
});

describe("validatePlatformSettings", () => {
  it("accepts 2 to 6 active platforms with valid colors and allowed slugs (null)", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it(`rejects fewer than ${MIN_CHART_PLATFORMS} active platforms`, () => {
    const entries = [entry("wallgold", true, "#e0921d", 0)];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });

  it(`rejects more than ${MAX_CHART_PLATFORMS} active platforms`, () => {
    const entries = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) =>
      entry(`p${i}`, true, "#123456", i),
    );
    const listed = new Set(entries.map((e) => e.slug));
    expect(validatePlatformSettings(entries, listed)).not.toBeNull();
  });

  it("rejects a null or malformed color on an active platform", () => {
    const withNull = [entry("wallgold", true, null, 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withNull, LISTED)).not.toBeNull();

    const withBad = [entry("wallgold", true, "bad", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withBad, LISTED)).not.toBeNull();
  });

  it("an invalid color on an inactive platform is not a problem", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("milli", false, "not-a-color", null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it("rejects an unknown/unlisted slug — even when it's off", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("goldika", false, null, null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });
});

describe("normalizePlatformSettings", () => {
  it("lowercases an active platform's color", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", true, "#E0921D", 0)]);
    expect(result!.chart_color).toBe("#e0921d");
  });

  it("clears an inactive platform's color/order, even if it has a value", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", false, "#e0921d", 3)]);
    expect(result).toEqual({
      slug: "wallgold",
      in_chart: false,
      chart_color: null,
      chart_order: null,
      referral_url: null,
    });
  });

  it("trims the referral URL", () => {
    const [result] = normalizePlatformSettings([
      entry("wallgold", true, "#e0921d", 0, "  https://wallgold.ir/r/mzn  "),
    ]);
    expect(result!.referral_url).toBe("https://wallgold.ir/r/mzn");
  });

  it("turns an empty referral URL (after trim) into null — meaning the override is removed", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", true, "#e0921d", 0, "   ")]);
    expect(result!.referral_url).toBeNull();
  });

  it("an inactive platform's referral URL is normalized untouched too — independent of chart membership", () => {
    const [result] = normalizePlatformSettings([
      entry("wallgold", false, null, null, "https://wallgold.ir/r/mzn"),
    ]);
    expect(result!.referral_url).toBe("https://wallgold.ir/r/mzn");
  });
});

describe("isValidReferralUrl", () => {
  const WEBSITE = "https://wallgold.ir";

  it("accepts the official website's own domain with https", () => {
    expect(isValidReferralUrl("https://wallgold.ir/r/mzn-secret", WEBSITE)).toBe(true);
  });

  it("accepts a subdomain of the official website", () => {
    expect(isValidReferralUrl("https://app.wallgold.ir/r/mzn-secret", WEBSITE)).toBe(true);
  });

  it("rejects a non-https scheme", () => {
    expect(isValidReferralUrl("http://wallgold.ir/r/mzn", WEBSITE)).toBe(false);
  });

  it("rejects an unrelated domain", () => {
    expect(isValidReferralUrl("https://evil.example/r/mzn", WEBSITE)).toBe(false);
  });

  it("rejects a domain that merely ends with the platform name (no dot)", () => {
    expect(isValidReferralUrl("https://evilwallgold.ir/r/mzn", WEBSITE)).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isValidReferralUrl("not-a-url", WEBSITE)).toBe(false);
  });

  it("without a documented website_url, every URL is rejected", () => {
    expect(isValidReferralUrl("https://wallgold.ir/r/mzn", null)).toBe(false);
  });
});

describe("validateReferralUrls", () => {
  const PLATFORMS: PlatformOption[] = [
    { slug: "wallgold", name_fa: "وال‌گلد", website_url: "https://wallgold.ir" },
    { slug: "talasea", name_fa: "طلاسی", website_url: "https://talasea.ir" },
    { slug: "bihich", name_fa: "بی‌هیچ", website_url: null },
  ];

  it("always accepts a null referral URL (no override)", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, null)];
    expect(validateReferralUrls(entries, PLATFORMS)).toBeNull();
  });

  it("accepts a valid same-domain URL", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "https://wallgold.ir/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).toBeNull();
  });

  it("rejects an insecure scheme with a clear message", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "http://wallgold.ir/r/mzn")];
    const error = validateReferralUrls(entries, PLATFORMS);
    expect(error).not.toBeNull();
    expect(error).toContain("wallgold");
  });

  it("rejects an unrelated domain", () => {
    const entries = [entry("talasea", true, "#9b8ce8", 0, "https://wallgold.ir/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).not.toBeNull();
  });

  it("rejects a platform without a documented website_url, no matter the URL", () => {
    const entries = [entry("bihich", false, null, null, "https://bihich.example/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).not.toBeNull();
  });

  it("the error message never prints the referral URL itself", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "http://wallgold.ir/r/SECRET-CODE")];
    const error = validateReferralUrls(entries, PLATFORMS);
    expect(error).not.toBeNull();
    expect(error).not.toContain("SECRET-CODE");
  });
});
