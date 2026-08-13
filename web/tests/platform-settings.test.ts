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
  it("#rrggbb با حروف بزرگ یا کوچک را می‌پذیرد", () => {
    expect(isValidChartColor("#1d6fe0")).toBe(true);
    expect(isValidChartColor("#1D6FE0")).toBe(true);
  });

  it("شکل نادرست را رد می‌کند", () => {
    expect(isValidChartColor("1d6fe0")).toBe(false);
    expect(isValidChartColor("#1d6f")).toBe(false);
    expect(isValidChartColor("red")).toBe(false);
  });
});

describe("validatePlatformSettings", () => {
  it("بین ۲ تا ۶ سکوی فعال با رنگ معتبر و اسلاگ مجاز را می‌پذیرد (null)", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it(`کمتر از ${MIN_CHART_PLATFORMS} سکوی فعال را رد می‌کند`, () => {
    const entries = [entry("wallgold", true, "#e0921d", 0)];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });

  it(`بیش از ${MAX_CHART_PLATFORMS} سکوی فعال را رد می‌کند`, () => {
    const entries = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) =>
      entry(`p${i}`, true, "#123456", i),
    );
    const listed = new Set(entries.map((e) => e.slug));
    expect(validatePlatformSettings(entries, listed)).not.toBeNull();
  });

  it("رنگ null یا بدشکل روی سکوی فعال را رد می‌کند", () => {
    const withNull = [entry("wallgold", true, null, 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withNull, LISTED)).not.toBeNull();

    const withBad = [entry("wallgold", true, "bad", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withBad, LISTED)).not.toBeNull();
  });

  it("رنگ نامعتبر روی سکوی غیرفعال مشکلی ندارد", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("milli", false, "not-a-color", null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it("اسلاگ ناشناخته/غیرقابل‌نمایش را رد می‌کند — حتی وقتی خاموش است", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("goldika", false, null, null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });
});

describe("normalizePlatformSettings", () => {
  it("رنگ سکوی فعال را lower می‌کند", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", true, "#E0921D", 0)]);
    expect(result!.chart_color).toBe("#e0921d");
  });

  it("رنگ/ترتیب سکوی غیرفعال را پاک می‌کند، حتی اگر مقداری داشته باشد", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", false, "#e0921d", 3)]);
    expect(result).toEqual({
      slug: "wallgold",
      in_chart: false,
      chart_color: null,
      chart_order: null,
      referral_url: null,
    });
  });

  it("نشانی معرف را trim می‌کند", () => {
    const [result] = normalizePlatformSettings([
      entry("wallgold", true, "#e0921d", 0, "  https://wallgold.ir/r/mzn  "),
    ]);
    expect(result!.referral_url).toBe("https://wallgold.ir/r/mzn");
  });

  it("نشانی معرف خالی (بعد از trim) را null می‌کند — یعنی حذف override", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", true, "#e0921d", 0, "   ")]);
    expect(result!.referral_url).toBeNull();
  });

  it("نشانی معرف سکوی غیرفعال هم دست‌نخورده نرمال می‌شود — مستقل از عضویت نمودار", () => {
    const [result] = normalizePlatformSettings([
      entry("wallgold", false, null, null, "https://wallgold.ir/r/mzn"),
    ]);
    expect(result!.referral_url).toBe("https://wallgold.ir/r/mzn");
  });
});

describe("isValidReferralUrl", () => {
  const WEBSITE = "https://wallgold.ir";

  it("همان دامنه‌ی وبسایت رسمی با https را می‌پذیرد", () => {
    expect(isValidReferralUrl("https://wallgold.ir/r/mzn-secret", WEBSITE)).toBe(true);
  });

  it("زیردامنه‌ی وبسایت رسمی را می‌پذیرد", () => {
    expect(isValidReferralUrl("https://app.wallgold.ir/r/mzn-secret", WEBSITE)).toBe(true);
  });

  it("طرح غیر-https را رد می‌کند", () => {
    expect(isValidReferralUrl("http://wallgold.ir/r/mzn", WEBSITE)).toBe(false);
  });

  it("دامنه‌ی نامرتبط را رد می‌کند", () => {
    expect(isValidReferralUrl("https://evil.example/r/mzn", WEBSITE)).toBe(false);
  });

  it("دامنه‌ای که فقط با نام سکو تمام می‌شود (بدون نقطه) را رد می‌کند", () => {
    expect(isValidReferralUrl("https://evilwallgold.ir/r/mzn", WEBSITE)).toBe(false);
  });

  it("نشانی بدشکل را رد می‌کند", () => {
    expect(isValidReferralUrl("not-a-url", WEBSITE)).toBe(false);
  });

  it("بدون website_url مستند، هر نشانی‌ای رد می‌شود", () => {
    expect(isValidReferralUrl("https://wallgold.ir/r/mzn", null)).toBe(false);
  });
});

describe("validateReferralUrls", () => {
  const PLATFORMS: PlatformOption[] = [
    { slug: "wallgold", name_fa: "وال‌گلد", website_url: "https://wallgold.ir" },
    { slug: "talasea", name_fa: "طلاسی", website_url: "https://talasea.ir" },
    { slug: "bihich", name_fa: "بی‌هیچ", website_url: null },
  ];

  it("نشانی معرف null (override ندارد) را همیشه می‌پذیرد", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, null)];
    expect(validateReferralUrls(entries, PLATFORMS)).toBeNull();
  });

  it("نشانی معتبرِ هم‌دامنه را می‌پذیرد", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "https://wallgold.ir/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).toBeNull();
  });

  it("طرح ناامن را با پیام روشن رد می‌کند", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "http://wallgold.ir/r/mzn")];
    const error = validateReferralUrls(entries, PLATFORMS);
    expect(error).not.toBeNull();
    expect(error).toContain("wallgold");
  });

  it("دامنه‌ی نامرتبط را رد می‌کند", () => {
    const entries = [entry("talasea", true, "#9b8ce8", 0, "https://wallgold.ir/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).not.toBeNull();
  });

  it("سکوی بدون website_url مستند را با هر نشانی‌ای رد می‌کند", () => {
    const entries = [entry("bihich", false, null, null, "https://bihich.example/r/mzn")];
    expect(validateReferralUrls(entries, PLATFORMS)).not.toBeNull();
  });

  it("پیام خطا هرگز خودِ نشانی معرف را چاپ نمی‌کند", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0, "http://wallgold.ir/r/SECRET-CODE")];
    const error = validateReferralUrls(entries, PLATFORMS);
    expect(error).not.toBeNull();
    expect(error).not.toContain("SECRET-CODE");
  });
});
