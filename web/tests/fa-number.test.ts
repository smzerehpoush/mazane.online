/**
 * ⚠️ This test deliberately makes **no comparison against `Intl`.** If we
 * built the expectations from `Intl.NumberFormat("fa-IR")`, the test would
 * measure exactly the thing `lib/fa-number.ts` was meant to free itself
 * from: the runtime's ICU version. It would then pass on a laptop's Node
 * (ICU 78) and fail on CI's Node or the production image's different
 * version — and worse, if CLDR ever changes the Persian table, the test
 * would change right along with it and confirm precisely the regression
 * it's supposed to catch.
 */
import { describe, expect, it, vi } from "vitest";

import {
  formatFaClock,
  formatFaNumber,
  formatFaPercentFromFraction,
  formatFaPercentPoints,
} from "../src/lib/fa-number";
import {
  formatMinutesAgoFa,
  formatPercentFa,
  formatPercentPointsFa,
  formatSignedPercentFa,
  formatToman,
} from "../src/lib/format";

const GROUP = "٬";
const DECIMAL = "٫";
const PERCENT = "٪";
const MINUS = "−";
const LRM = "‎";

describe("digits and separators", () => {
  it("converts Latin digits to Persian", () => {
    expect(formatFaNumber(0)).toBe("۰");
    expect(formatFaNumber(7)).toBe("۷");
    expect(formatFaNumber(1234567890)).toBe(`۱${GROUP}۲۳۴${GROUP}۵۶۷${GROUP}۸۹۰`);
  });

  it("groups thousands with U+066C, not a Latin comma", () => {
    expect(formatFaNumber(1234)).toBe(`۱${GROUP}۲۳۴`);
    expect(formatFaNumber(18611000)).toBe(`۱۸${GROUP}۶۱۱${GROUP}۰۰۰`);
    expect(formatFaNumber(1234)).not.toContain(",");
  });

  it("a three-digit number or fewer isn't grouped", () => {
    expect(formatFaNumber(999)).toBe("۹۹۹");
    expect(formatFaNumber(100)).toBe("۱۰۰");
  });

  it("writes the decimal point with U+066B, not a dot", () => {
    expect(formatFaNumber(0.5, { maximumFractionDigits: 3 })).toBe(`۰${DECIMAL}۵`);
    expect(formatFaNumber(1.25, { maximumFractionDigits: 3 })).toBe(`۱${DECIMAL}۲۵`);
    expect(formatFaNumber(0.5, { maximumFractionDigits: 3 })).not.toContain(".");
  });

  it("writes negative with U+200E + U+2212, not an ASCII hyphen", () => {
    expect(formatFaNumber(-1234)).toBe(`${LRM}${MINUS}۱${GROUP}۲۳۴`);
    expect(formatFaNumber(-1234)).not.toContain("-");
  });
});

describe("rounding", () => {
  /**
   * ⚠️ A real regression: the first implementation was written with
    * `toFixed` and gave "2.00" here, because 2.005 in binary is
   * 2.00499…. ICU rounds on the **short decimal representation**, not
   * the binary value. Any rewrite that turns this test red has
   * repeated the same mistake.
   */
  it("half-up rounding operates on the decimal representation, not the binary value", () => {
    expect(formatFaNumber(2.005, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `۲${DECIMAL}۰۱`,
    );
    expect(formatFaNumber(-2.005, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `${LRM}${MINUS}۲${DECIMAL}۰۱`,
    );
  });

  it("a rounding overflow carries correctly into the integer digit", () => {
    expect(formatFaNumber(9.99, { maximumFractionDigits: 1 })).toBe(`۱۰`);
    expect(formatFaNumber(999.95, { maximumFractionDigits: 1 })).toBe(`۱${GROUP}۰۰۰`);
  });

  it("trailing zeros are kept only down to the requested minimum", () => {
    expect(formatFaNumber(2, { maximumFractionDigits: 3 })).toBe("۲");
    expect(formatFaNumber(2, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `۲${DECIMAL}۰۰`,
    );
    expect(formatFaNumber(0.995, { maximumFractionDigits: 3 })).toBe(`۰${DECIMAL}۹۹۵`);
  });

  it("correctly expands a number given in exponential notation too", () => {
    expect(formatFaNumber(0.0000004, { maximumFractionDigits: 7 })).toBe(`۰${DECIMAL}۰۰۰۰۰۰۴`);
    expect(formatFaNumber(0.0000004, { maximumFractionDigits: 2 })).toBe("۰");
  });
});

describe("sign", () => {
  it("auto: a negative that rounds to zero keeps its sign", () => {
    expect(formatFaPercentFromFraction(-0.000004, { maximumFractionDigits: 2 })).toBe(
      `${LRM}${MINUS}۰${PERCENT}`,
    );
  });

  it("exceptZero: the same input comes out unsigned", () => {
    expect(
      formatFaPercentFromFraction(-0.000004, {
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      }),
    ).toBe(`۰${PERCENT}`);
    expect(
      formatFaPercentFromFraction(0.000004, {
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      }),
    ).toBe(`۰${PERCENT}`);
  });

  it("exceptZero: a nonzero positive gets a + sign", () => {
    expect(
      formatFaPercentFromFraction(0.0039, {
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      }),
    ).toBe(`${LRM}+۰${DECIMAL}۳۹${PERCENT}`);
  });

  it("negative zero gets no sign (a deliberate divergence from Intl)", () => {
    expect(formatFaNumber(-0)).toBe("۰");
  });
});

describe("invalid input — staleness, not error", () => {
  it("NaN and infinity produce «—» and are never silently swallowed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaNumber(Number.NaN)).toBe("—");
    expect(formatFaNumber(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatFaPercentFromFraction(Number.NaN)).toBe("—");
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("a number beyond the decimal-display limit also gets «—», not «1e+21»", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaNumber(1e21)).toBe("—");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("consumers — the output must not have changed from before", () => {
  it("formatToman: today's real prices", () => {
    expect(formatToman(18611000)).toBe(`۱۸${GROUP}۶۱۱${GROUP}۰۰۰`);
    expect(formatToman(18530000)).toBe(`۱۸${GROUP}۵۳۰${GROUP}۰۰۰`);
  });

  it("formatPercentPointsFa: percent as delivered by the collector (a Postgres numeric string)", () => {
    expect(formatPercentPointsFa("0.5000")).toBe(`۰${DECIMAL}۵${PERCENT}`);
    expect(formatPercentPointsFa("0.0000")).toBe(`۰${PERCENT}`);
    expect(formatPercentPointsFa("0.9950")).toBe(`۰${DECIMAL}۹۹۵${PERCENT}`);
  });

  it("formatPercentFa: fraction ⟸ percent", () => {
    expect(formatPercentFa(0.0039)).toBe(`۰${DECIMAL}۳۹${PERCENT}`);
    expect(formatPercentFa(0.31)).toBe(`۳۱${PERCENT}`);
  });

  it("formatSignedPercentFa: the rate card's \"changes\" column", () => {
    expect(formatSignedPercentFa(0.0071)).toBe(`${LRM}+۰${DECIMAL}۷۱${PERCENT}`);
    expect(formatSignedPercentFa(-0.0012)).toBe(`${LRM}${MINUS}۰${DECIMAL}۱۲${PERCENT}`);
    expect(formatSignedPercentFa(0)).toBe(`۰${PERCENT}`);
  });

  it("formatMinutesAgoFa: the staleness label", () => {
    expect(formatMinutesAgoFa(0)).toBe("لحظاتی پیش");
    expect(formatMinutesAgoFa(3)).toBe("۳ دقیقه پیش");
    expect(formatMinutesAgoFa(1500)).toBe(`۱${GROUP}۵۰۰ دقیقه پیش`);
  });
});

describe("determinism", () => {
  it("output doesn't depend on global state or prior calls", () => {
    const once = formatFaNumber(18611000);
    for (let i = 0; i < 100; i++) {
      formatFaNumber(Math.random() * 1e9, { maximumFractionDigits: 3 });
    }
    expect(formatFaNumber(18611000)).toBe(once);
  });

  it("no Latin character appears in the output (except the + sign, which Intl itself renders in Latin too)", () => {
    expect(formatFaNumber(1234567.89, { maximumFractionDigits: 2 })).not.toMatch(/[0-9.,]/);
  });
});

/**
  * ⚠️ Why this was needed too: `lib/dashboard.ts` built the "last
  * update" label and the time of the market summary's high/low with
 * `Intl.DateTimeFormat`, and `buildDashboard` is called inside
 * `HomePage`'s render body — meaning it ran **both on the server and
 * during hydration**. The same ICU-divergence risk this file had closed
 * off for numbers had come back in through another door.
 */
describe("Persian clock — no Intl", () => {
  it("converts UTC time to Tehran time", () => {
    expect(formatFaClock("2026-08-11T09:00:00Z")).toBe("۱۲:۳۰");
  });

  it("correctly wraps around midnight", () => {
    expect(formatFaClock("2026-01-15T20:35:00Z")).toBe("۰۰:۰۵");
    expect(formatFaClock("2026-08-11T20:30:00Z")).toBe("۰۰:۰۰");
  });

  it("is always two digits and separated by an ASCII colon", () => {
    const out = formatFaClock("2026-08-11T04:35:00Z");
    expect(out).toBe("۰۸:۰۵");
    expect(out.charCodeAt(2)).toBe(0x3a);
  });

  it("summer and winter share the same offset (Iran has no daylight saving)", () => {
    expect(formatFaClock("2026-01-15T12:00:00Z")).toBe("۱۵:۳۰");
    expect(formatFaClock("2026-07-15T12:00:00Z")).toBe("۱۵:۳۰");
  });

  it("invalid input produces «—» and is never silently swallowed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaClock("چرند")).toBe("—");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
