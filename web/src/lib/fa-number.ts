/**
 * قالب‌بندی عدد فارسی — **بدون هیچ وابستگی به `Intl`**.
 *
 * چرا این ماژول وجود دارد (بند ۱۴ سند طراحی، «منبع اصلی hydration mismatch»):
 *
 * `Intl.NumberFormat("fa-IR")` خروجی‌اش را از جدول‌های CLDR داخل ICU می‌گیرد،
 * و **نسخه‌ی ICU سرور با نسخه‌ی ICU مرورگر یکی نیست**. اندازه‌گیری واقعی روی
 * همین مخزن: نود لپ‌تاپ ICU 78.3 / CLDR 48 دارد، ایمیج تولید `node:22-alpine`
 * نسخه‌ی دیگری، و هر مرورگر کاربر نسخه‌ی سوم. تا امروز جدول‌های عددی فارسی در
 * CLDR ثابت مانده‌اند و مشکلی ندیده‌ایم — ولی این «تا امروز» یک تضمین نیست،
 * و شکستنش بی‌صدا است: ری‌اکت متن ناهمخوان را در hydration دور می‌ریزد و
 * دوباره می‌سازد، پس در لاگ چیزی نمی‌بینیم و فقط عدد یک لحظه می‌پرد.
 *
 * پس قاعده از این پس: **هیچ عددی که رندر می‌شود از `Intl` رد نمی‌شود.**
 * قواعد فارسی‌سازی عدد در همین فایل صریح‌اند و هر دو سمت یک کد را اجرا
 * می‌کنند، پس خروجی به‌طور ساختاری یکسان است، نه اتفاقی.
 *
 * ⚠️ این جایگزینی **هیچ تغییر بصری‌ای ندارد**: خروجی بایت‌به‌بایت با چیزی که
 * `Intl.NumberFormat("fa-IR")` امروز می‌دهد یکی است. نویسه‌ها عمداً با کد
 * یونیکد نوشته شده‌اند چون چند تایشان در ویرایشگر نامرئی یا هم‌شکل‌اند:
 *
 *   U+066C ٬ جداکننده‌ی هزارگان عربی — **نه** ویرگول لاتین و نه ویرگول فارسی
 *   U+066B ٫ جداکننده‌ی اعشار عربی  — **نه** نقطه
 *   U+066A ٪ درصد عربی             — **نه** `%` لاتین
 *   U+2212 − علامت منها             — **نه** خط تیره‌ی ASCII
 *   U+200E   نشانه‌ی چپ‌به‌راست       — نامرئی؛ پیش از علامت می‌آید تا در متن
 *                                     راست‌به‌چپ، «−۱۲٪» به «۱۲٪−» نچرخد
 *
 * ⚠️ قاعده‌ی سخت ۱ قراردادها: اینجا هیچ فرمول قیمتی نیست. این ماژول فقط
 * `number` را به رشته‌ی نمایشی تبدیل می‌کند و اصلاً نمی‌داند عدد چیست.
 *
 * ارقام داخل JSON-LD و URL لاتین می‌مانند و هرگز از این توابع رد نمی‌شوند.
 *
 * **تنها واگرایی عمدی از `Intl`** — صفرِ منفی (`-0`): `Intl` برایش «‎−۰»
 * می‌دهد، ما «۰». `-0` یک کمیت منفی نیست و در این دامنه هم تولیدشدنی نیست
 * (قیمت و درصد تغییر هیچ‌کدام به `-0` نمی‌رسند)؛ اگر روزی برسد، نشانه‌ی باگ
 * است نه عددی که باید با علامت منها نمایش داده شود. تست این واگرایی را پین
 * کرده تا تصادفی برنگردد.
 */

/** ارقام فارسی ۰ تا ۹ (U+06F0..U+06F9)، به ترتیب مقدار. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const GROUP_SEPARATOR = "٬";
const DECIMAL_SEPARATOR = "٫";
const PERCENT_SIGN = "٪";
const MINUS_SIGN = "−";
const PLUS_SIGN = "+";
const LTR_MARK = "‎";

/**
 * سقفی که بالاتر از آن `toFixed` به نماد نمایی می‌افتد («1e+21») و گروه‌بندی
 * بی‌معنا می‌شود. قیمت طلا حدود ۱۰⁷ است، پس این مرز عملاً هرگز لمس نمی‌شود —
 * فقط برای این هست که یک ورودی خراب، رشته‌ی بی‌معنا روی صفحه نگذارد.
 */
const MAX_SAFE_MAGNITUDE = 1e21;

/**
 * ورودی نامعتبر (NaN، بی‌نهایت، بزرگ‌تر از حد) ⟸ همان «—» که جدول برای
 * «نامعلوم» می‌گذارد. صفحه ۲۰۰ می‌ماند (قاعده‌ی سخت ۵)، ولی چون این حالت
 * یعنی **باگ** نه «نامعلوم»، بی‌صدا رد نمی‌شود و در کنسول هشدار می‌دهد.
 */
const INVALID_PLACEHOLDER = "—";

export interface FaNumberOptions {
  /** حداقل رقم اعشار — کم‌تر از این با صفر پر می‌شود. پیش‌فرض ۰. */
  minimumFractionDigits?: number;
  /** حداکثر رقم اعشار — بیش‌تر از این گرد می‌شود. پیش‌فرض = حداقل. */
  maximumFractionDigits?: number;
  /** `exceptZero` یعنی عدد مثبت هم علامت `+` بگیرد (صفر هرگز نمی‌گیرد). */
  signDisplay?: "auto" | "exceptZero";
}

/** ارقام لاتین یک رشته ⟸ ارقام فارسی؛ بقیه‌ی نویسه‌ها دست‌نخورده. */
function toPersianDigits(latin: string): string {
  let out = "";
  for (const char of latin) {
    const digit = char.charCodeAt(0) - 48;
    out += digit >= 0 && digit <= 9 ? PERSIAN_DIGITS[digit] : char;
  }
  return out;
}

/** گروه‌بندی سه‌رقمی از راست — قاعده‌ی فارسی، بدون استثنای «۴ رقم گروه نمی‌شود». */
function groupThousands(digits: string): string {
  let out = "";
  for (let index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 === 0) out += GROUP_SEPARATOR;
    out += digits[index];
  }
  return out;
}

/**
 * عدد نامنفی ⟸ رشته‌ی ده‌دهی **بدون نماد نمایی**.
 *
 * `String(0.0000004)` می‌دهد `"4e-7"`؛ گرد کردن رشته‌ای روی آن بی‌معناست، پس
 * اول مانتیس و نما باز می‌شوند. مبنا `String(value)` است، یعنی «کوتاه‌ترین
 * رشته‌ای که دقیقاً به همین double برمی‌گردد» — همان چیزی که ICU هم مبنا
 * می‌گیرد (دلیلش در `roundAbsolute` پایین).
 */
function toPlainDecimal(value: number): string {
  const text = String(value);
  const exponentIndex = text.indexOf("e");
  if (exponentIndex === -1) return text;

  const mantissa = text.slice(0, exponentIndex);
  const exponent = Number(text.slice(exponentIndex + 1));
  const pointIndex = mantissa.indexOf(".");
  const digits =
    pointIndex === -1 ? mantissa : mantissa.slice(0, pointIndex) + mantissa.slice(pointIndex + 1);
  const pointPosition = (pointIndex === -1 ? mantissa.length : pointIndex) + exponent;

  if (pointPosition <= 0) return `0.${"0".repeat(-pointPosition)}${digits}`;
  if (pointPosition >= digits.length) return digits + "0".repeat(pointPosition - digits.length);
  return `${digits.slice(0, pointPosition)}.${digits.slice(pointPosition)}`;
}

/** «۱۲۹۹» ⟸ «۱۳۰۰» — سرریز رقم‌به‌رقم روی رشته، بدون برگشت به شناور. */
function incrementDigits(digits: string): string {
  const chars = [...digits];
  for (let index = chars.length - 1; index >= 0; index--) {
    if (chars[index] === "9") {
      chars[index] = "0";
      continue;
    }
    chars[index] = String(Number(chars[index]) + 1);
    return chars.join("");
  }
  return `1${chars.join("")}`;
}

/**
 * گرد کردن قدرمطلق یک عدد به `fractionDigits` رقم اعشار، **نیم‌رو-به-بالا روی
 * نمایش ده‌دهی**.
 *
 * ⚠️ چرا نه `toFixed`: `toFixed` روی مقدار **دودویی** گرد می‌کند و ICU روی
 * **نمایش ده‌دهی کوتاه**. این دو یکی نیستند و اختلافشان دیده شد:
 * `(2.005).toFixed(2)` می‌دهد «2.00» (چون ۲٫۰۰۵ در دودویی ۲٫۰۰۴۹۹…ست) ولی
 * `Intl` می‌دهد «۲٫۰۱». چون قرار است خروجی این ماژول بایت‌به‌بایت جانشین
 * `Intl` باشد، قاعده‌ی ICU پیاده می‌شود نه قاعده‌ی `toFixed`.
 */
function roundAbsolute(
  value: number,
  fractionDigits: number,
): { integerPart: string; fractionPart: string } {
  const plain = toPlainDecimal(Math.abs(value));
  const pointIndex = plain.indexOf(".");
  const integerText = pointIndex === -1 ? plain : plain.slice(0, pointIndex);
  const fractionText = pointIndex === -1 ? "" : plain.slice(pointIndex + 1);

  if (fractionText.length <= fractionDigits) {
    return { integerPart: integerText, fractionPart: fractionText.padEnd(fractionDigits, "0") };
  }

  let combined = integerText + fractionText.slice(0, fractionDigits);
  if (fractionText.charCodeAt(fractionDigits) - 48 >= 5) combined = incrementDigits(combined);

  // بعد از سرریز محاسبه می‌شود، وگرنه «۹٫۹۹ ⟸ ۱۰٫۰» یک رقم جابه‌جا می‌افتد.
  const cut = combined.length - fractionDigits;
  return { integerPart: combined.slice(0, cut) || "0", fractionPart: combined.slice(cut) };
}

/**
 * عدد ⟸ رشته‌ی فارسی. جانشین مستقیم `Intl.NumberFormat("fa-IR").format`.
 *
 * گرد کردن نیم‌رو-به-بالا روی نمایش ده‌دهی است — قاعده‌ی ICU، نه قاعده‌ی
 * `toFixed`. توضیحش در `roundAbsolute`.
 */
export function formatFaNumber(value: number, options: FaNumberOptions = {}): string {
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;
  const signDisplay = options.signDisplay ?? "auto";

  if (!Number.isFinite(value) || Math.abs(value) >= MAX_SAFE_MAGNITUDE) {
    console.warn(`formatFaNumber: عدد نامعتبر برای نمایش — ${String(value)}`);
    return INVALID_PLACEHOLDER;
  }

  const { integerPart, fractionPart } = roundAbsolute(value, maximumFractionDigits);

  // صفرهای انتهایی فقط تا سقف «حداقل رقم اعشار» بریده می‌شوند — دقیقاً
  // سمانتیک minimumFractionDigits/maximumFractionDigits در Intl.
  let fraction = fractionPart;
  while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }

  const body = groupThousands(integerPart) + (fraction === "" ? "" : DECIMAL_SEPARATOR + fraction);

  // ⚠️ دو حالت `signDisplay` قاعده‌ی «صفر» متفاوتی دارند و این عمداً آینه‌ی
  // رفتار `Intl` است، نه سلیقه‌ی ما (ECMA-402):
  //
  //   auto       — علامت از **ورودی** می‌آید. ‎−۰٫۰۰۰۴‎ با دو رقم اعشار
  //                «‎−۰٪» می‌شود نه «۰٪»؛ عدد واقعاً منفی است و گم‌کردن
  //                علامتش بدتر از زشتیِ «‎−۰» است.
  //   exceptZero — علامت از **مقدار گردشده** می‌آید. همان ورودی «۰٪» می‌شود،
  //                بی‌علامت.
  //
  // این ناهمگونی ICU است و اگر یکدستش کنیم، جانشینی بایت‌به‌بایت می‌شکند.
  const roundsToZero = !/[1-9]/.test(integerPart + fractionPart);
  let sign = "";
  if (signDisplay === "exceptZero") {
    if (!roundsToZero) sign = LTR_MARK + (value < 0 ? MINUS_SIGN : PLUS_SIGN);
  } else if (value < 0) {
    sign = LTR_MARK + MINUS_SIGN;
  }

  return sign + toPersianDigits(body);
}

/**
 * درصد. ورودی **کسر** است (۰٫۰۰۳۹ ⟸ «۰٫۳۹٪») — همان قرارداد
 * `style: "percent"` در Intl، تا جای مصرف‌کننده‌ها عوض نشود.
 */
export function formatFaPercentFromFraction(
  fraction: number,
  options: FaNumberOptions = {},
): string {
  if (!Number.isFinite(fraction)) {
    console.warn(`formatFaPercentFromFraction: کسر نامعتبر — ${String(fraction)}`);
    return INVALID_PLACEHOLDER;
  }
  return formatFaNumber(fraction * 100, options) + PERCENT_SIGN;
}

/**
 * درصدی که **از قبل بر حسب واحد درصد** است (رشته‌ی «0.5000» گردآورنده ⟸
 * «۰٫۵٪») — بی‌ضرب در ۱۰۰، بر خلاف تابع بالا.
 */
export function formatFaPercentPoints(points: number, options: FaNumberOptions = {}): string {
  return formatFaNumber(points, options) + PERCENT_SIGN;
}
