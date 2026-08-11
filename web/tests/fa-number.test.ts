/**
 * قالب‌بندی عدد فارسی — نگهبان بند ۱۴ سند طراحی.
 *
 * ⚠️ این تست عمداً **هیچ مقایسه‌ای با `Intl` نمی‌کند.** اگر انتظارها را از
 * `Intl.NumberFormat("fa-IR")` بسازیم، تست دقیقاً همان چیزی را می‌سنجد که
 * `lib/fa-number.ts` قرار بود از آن رها شود: نسخه‌ی ICU محیط اجرا. آن‌وقت
 * روی نود لپ‌تاپ (ICU 78) سبز می‌شد و روی نود CI یا ایمیج تولید نسخه‌ی دیگر،
 * و بدتر — اگر روزی CLDR جدول فارسی را عوض کند، تست همراهش عوض می‌شد و
 * دقیقاً همان رگرسیونی که باید بگیرد را تأیید می‌کرد.
 *
 * پس انتظارها **رشته‌ی صریح** اند. درستی‌شان یک‌بار (۲۰۲۶-۰۸-۱۱) با مقایسه‌ی
 * ۴۰٬۰۵۶ نمونه با `Intl.NumberFormat("fa-IR")` روی ICU 78.3 / CLDR 48
 * راستی‌آزمایی شد: یک اختلاف، همان واگرایی عمدی صفرِ منفی که پایین پین شده.
 *
 * نویسه‌های نامرئی/هم‌شکل با کد یونیکد نوشته شده‌اند، وگرنه بازبینی این فایل
 * در ویرایشگر ممکن نیست:
 *   U+066C ٬ هزارگان · U+066B ٫ اعشار · U+066A ٪ درصد
 *   U+2212 − منها (نه خط تیره) · U+200E نشانه‌ی چپ‌به‌راست (نامرئی)
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

describe("ارقام و جداکننده‌ها", () => {
  it("ارقام لاتین را به فارسی می‌برد", () => {
    expect(formatFaNumber(0)).toBe("۰");
    expect(formatFaNumber(7)).toBe("۷");
    expect(formatFaNumber(1234567890)).toBe(`۱${GROUP}۲۳۴${GROUP}۵۶۷${GROUP}۸۹۰`);
  });

  it("هزارگان را با U+066C گروه می‌کند، نه با ویرگول لاتین", () => {
    expect(formatFaNumber(1234)).toBe(`۱${GROUP}۲۳۴`);
    expect(formatFaNumber(18611000)).toBe(`۱۸${GROUP}۶۱۱${GROUP}۰۰۰`);
    expect(formatFaNumber(1234)).not.toContain(",");
  });

  it("عدد سه‌رقمی و کم‌تر گروه نمی‌گیرد", () => {
    expect(formatFaNumber(999)).toBe("۹۹۹");
    expect(formatFaNumber(100)).toBe("۱۰۰");
  });

  it("اعشار را با U+066B می‌نویسد، نه با نقطه", () => {
    expect(formatFaNumber(0.5, { maximumFractionDigits: 3 })).toBe(`۰${DECIMAL}۵`);
    expect(formatFaNumber(1.25, { maximumFractionDigits: 3 })).toBe(`۱${DECIMAL}۲۵`);
    expect(formatFaNumber(0.5, { maximumFractionDigits: 3 })).not.toContain(".");
  });

  it("منفی را با U+200E + U+2212 می‌نویسد، نه با خط تیره‌ی ASCII", () => {
    expect(formatFaNumber(-1234)).toBe(`${LRM}${MINUS}۱${GROUP}۲۳۴`);
    expect(formatFaNumber(-1234)).not.toContain("-");
  });
});

describe("گرد کردن", () => {
  /**
   * ⚠️ رگرسیون واقعی: پیاده‌سازی اول با `toFixed` نوشته شده بود و اینجا
   * «۲٫۰۰» می‌داد، چون ۲٫۰۰۵ در دودویی ۲٫۰۰۴۹۹…ست. ICU روی **نمایش ده‌دهی
   * کوتاه** گرد می‌کند، نه روی مقدار دودویی. هر بازنویسی‌ای که این تست را
   * قرمز کند، همان اشتباه را تکرار کرده.
   */
  it("نیم‌رو-به-بالا روی نمایش ده‌دهی است، نه روی مقدار دودویی", () => {
    expect(formatFaNumber(2.005, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `۲${DECIMAL}۰۱`,
    );
    expect(formatFaNumber(-2.005, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `${LRM}${MINUS}۲${DECIMAL}۰۱`,
    );
  });

  it("سرریز گرد کردن، رقم صحیح را درست جابه‌جا می‌کند", () => {
    expect(formatFaNumber(9.99, { maximumFractionDigits: 1 })).toBe(`۱۰`);
    expect(formatFaNumber(999.95, { maximumFractionDigits: 1 })).toBe(`۱${GROUP}۰۰۰`);
  });

  it("صفرهای انتهایی فقط تا حداقلِ خواسته‌شده می‌مانند", () => {
    expect(formatFaNumber(2, { maximumFractionDigits: 3 })).toBe("۲");
    expect(formatFaNumber(2, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      `۲${DECIMAL}۰۰`,
    );
    expect(formatFaNumber(0.995, { maximumFractionDigits: 3 })).toBe(`۰${DECIMAL}۹۹۵`);
  });

  it("عدد با نماد نمایی را هم درست باز می‌کند", () => {
    // String(0.0000004) === "4e-7" — بدون بازکردن نما، گرد کردن رشته‌ای می‌شکند.
    expect(formatFaNumber(0.0000004, { maximumFractionDigits: 7 })).toBe(`۰${DECIMAL}۰۰۰۰۰۰۴`);
    expect(formatFaNumber(0.0000004, { maximumFractionDigits: 2 })).toBe("۰");
  });
});

describe("علامت", () => {
  it("auto: منفیِ گردشده-به-صفر علامتش را نگه می‌دارد", () => {
    expect(formatFaPercentFromFraction(-0.000004, { maximumFractionDigits: 2 })).toBe(
      `${LRM}${MINUS}۰${PERCENT}`,
    );
  });

  it("exceptZero: همان ورودی بی‌علامت می‌شود", () => {
    // ناهمگونی ICU، عمداً آینه شده — auto از ورودی تصمیم می‌گیرد و
    // exceptZero از مقدار گردشده.
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

  it("exceptZero: مثبتِ ناصفر علامت + می‌گیرد", () => {
    expect(
      formatFaPercentFromFraction(0.0039, {
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      }),
    ).toBe(`${LRM}+۰${DECIMAL}۳۹${PERCENT}`);
  });

  /**
   * تنها واگرایی عمدی از `Intl`، اینجا پین شده تا تصادفی برنگردد:
   * `Intl` برای `-0` رشته‌ی «‎−۰» می‌دهد. `-0` کمیت منفی نیست و در این
   * دامنه تولیدشدنی هم نیست؛ اگر برسد نشانه‌ی باگ است، نه عددی منفی.
   */
  it("صفرِ منفی علامت نمی‌گیرد (واگرایی عمدی از Intl)", () => {
    expect(formatFaNumber(-0)).toBe("۰");
  });
});

describe("ورودی نامعتبر — کهنگی نه خطا (قاعده‌ی سخت ۵)", () => {
  it("NaN و بی‌نهایت «—» می‌دهند و بی‌صدا رد نمی‌شوند", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaNumber(Number.NaN)).toBe("—");
    expect(formatFaNumber(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatFaPercentFromFraction(Number.NaN)).toBe("—");
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("عدد بزرگ‌تر از حدِ نمایشِ ده‌دهی هم «—» می‌گیرد، نه «1e+21»", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaNumber(1e21)).toBe("—");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

/**
 * مصرف‌کننده‌های واقعی. این‌ها همان رشته‌هایی‌اند که امروز روی سایت‌اند —
 * جایگزینی `Intl` نباید هیچ‌کدامشان را عوض کرده باشد.
 */
describe("مصرف‌کننده‌ها — خروجی نباید نسبت به قبل عوض شده باشد", () => {
  it("formatToman: قیمت‌های واقعی امروز", () => {
    expect(formatToman(18611000)).toBe(`۱۸${GROUP}۶۱۱${GROUP}۰۰۰`);
    expect(formatToman(18530000)).toBe(`۱۸${GROUP}۵۳۰${GROUP}۰۰۰`);
  });

  it("formatPercentPointsFa: درصد آماده‌ی گردآورنده (رشته‌ی numeric پستگرس)", () => {
    expect(formatPercentPointsFa("0.5000")).toBe(`۰${DECIMAL}۵${PERCENT}`);
    expect(formatPercentPointsFa("0.0000")).toBe(`۰${PERCENT}`);
    expect(formatPercentPointsFa("0.9950")).toBe(`۰${DECIMAL}۹۹۵${PERCENT}`);
  });

  it("formatPercentFa: کسر ⟸ درصد", () => {
    expect(formatPercentFa(0.0039)).toBe(`۰${DECIMAL}۳۹${PERCENT}`);
    expect(formatPercentFa(0.31)).toBe(`۳۱${PERCENT}`);
  });

  it("formatSignedPercentFa: ستون «تغییرات» کارت نرخ", () => {
    expect(formatSignedPercentFa(0.0071)).toBe(`${LRM}+۰${DECIMAL}۷۱${PERCENT}`);
    expect(formatSignedPercentFa(-0.0012)).toBe(`${LRM}${MINUS}۰${DECIMAL}۱۲${PERCENT}`);
    expect(formatSignedPercentFa(0)).toBe(`۰${PERCENT}`);
  });

  it("formatMinutesAgoFa: برچسب کهنگی", () => {
    expect(formatMinutesAgoFa(0)).toBe("لحظاتی پیش");
    expect(formatMinutesAgoFa(3)).toBe("۳ دقیقه پیش");
    expect(formatMinutesAgoFa(1500)).toBe(`۱${GROUP}۵۰۰ دقیقه پیش`);
  });
});

/**
 * قلب ماجرا: همان ورودی، همان خروجی — مستقل از محیط. اگر روزی کسی
 * `Intl.NumberFormat` را به این مسیر برگرداند، این تست چیزی نمی‌گیرد (روی
 * یک محیط اجرا می‌شود)، ولی تست‌های بالا با رشته‌های صریحشان می‌گیرند.
 * این یکی فقط ناب‌بودن تابع را پین می‌کند.
 */
describe("قطعی‌بودن", () => {
  it("خروجی به وضعیت سراسری یا فراخوانی‌های قبلی وابسته نیست", () => {
    const once = formatFaNumber(18611000);
    for (let i = 0; i < 100; i++) {
      formatFaNumber(Math.random() * 1e9, { maximumFractionDigits: 3 });
    }
    expect(formatFaNumber(18611000)).toBe(once);
  });

  it("هیچ نویسه‌ی لاتینی در خروجی نیست (جز علامت + که خودِ Intl هم لاتین می‌دهد)", () => {
    expect(formatFaNumber(1234567.89, { maximumFractionDigits: 2 })).not.toMatch(/[0-9.,]/);
  });
});

/**
 * ساعت فارسی — آخرین رشته‌ی رندرشده‌ای که هنوز از `Intl` رد می‌شد.
 *
 * ⚠️ چرا این هم لازم شد: `lib/dashboard.ts` برچسب «آخرین به‌روزرسانی» و ساعت
 * وقوع کمینه/بیشینه‌ی خلاصه بازار را با `Intl.DateTimeFormat` می‌ساخت، و
 * `buildDashboard` در بدنه‌ی رندر `HomePage` صدا زده می‌شود — یعنی **هم روی
 * سرور و هم موقع hydration** اجرا می‌شد. همان ریسک واگرایی ICU که این فایل
 * برای عدد بسته بود، از در دیگری برگشته بود.
 *
 * انتظارها با خروجی `Intl.DateTimeFormat("fa-IR", {hour:"2-digit",
 * minute:"2-digit", hour12:false, timeZone:"Asia/Tehran"})` روی ICU 78.3
 * راستی‌آزمایی شده‌اند — دو نقطه‌ی جداکننده در آن خروجی **کولون ASCII**
 * (U+003A) است، نه نویسه‌ی عربی.
 */
describe("ساعت فارسی — بدون Intl", () => {
  it("زمان UTC را به ساعت تهران می‌برد", () => {
    expect(formatFaClock("2026-08-11T09:00:00Z")).toBe("۱۲:۳۰");
  });

  it("گذر از نیمه‌شب را درست می‌چرخاند", () => {
    expect(formatFaClock("2026-01-15T20:35:00Z")).toBe("۰۰:۰۵");
    expect(formatFaClock("2026-08-11T20:30:00Z")).toBe("۰۰:۰۰");
  });

  it("همیشه دو رقمی است و با کولون ASCII جدا می‌شود", () => {
    const out = formatFaClock("2026-08-11T04:35:00Z");
    expect(out).toBe("۰۸:۰۵");
    expect(out.charCodeAt(2)).toBe(0x3a);
  });

  /**
   * ایران از ۱۴۰۱ (۲۰۲۲) ساعت تابستانی را برداشته و تهران تمام سال +۳:۳۰
   * است. اگر روزی برگردد، این تست باید بشکند — همان‌جاست که باید ببینیمش.
   */
  it("تابستان و زمستان یک اختلاف دارند (ایران ساعت تابستانی ندارد)", () => {
    expect(formatFaClock("2026-01-15T12:00:00Z")).toBe("۱۵:۳۰");
    expect(formatFaClock("2026-07-15T12:00:00Z")).toBe("۱۵:۳۰");
  });

  it("ورودی نامعتبر «—» می‌دهد و بی‌صدا رد نمی‌شود", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatFaClock("چرند")).toBe("—");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
