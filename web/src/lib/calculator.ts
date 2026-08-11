/**
 * تبدیل خالص وزن⟸مبلغ برای ماشین‌حساب صفحه‌ی سکو (بلیت ۳۵).
 *
 * فقط ضرب/تقسیم ساده روی یک قیمت واحدِ آماده‌ی گردآورنده (مؤثر خرید، مؤثر
 * فروش یا قیمت اسمی — هرکدام را `PlatformCalculator.tsx` می‌دهد) — هیچ
 * فرمول قیمتی، کارمزد یا میانگین بین‌سکویی‌ای اینجا محاسبه نمی‌شود (قاعده‌ی
 * ۱ و ۴ قراردادها). این ماژول حتی نمی‌داند «سکو» یعنی چه — فقط یک عدد واحد
 * می‌گیرد.
 *
 * ورودی خام کاربر رشته است و می‌تواند ارقام فارسی/عربی یا لاتین داشته باشد؛
 * `parseCalculatorInput` تنها دروازه‌ی تبدیل رشته⟸عدد است. خالی، نامعتبر،
 * صفر، منفی یا نامتناهی همه `null` برمی‌گردانند — هرگز صفر یا NaN ساختگی به
 * بیرون درز نمی‌کند تا فیلد دیگر با یک عدد جعلی پر نشود.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** جداکننده‌ی اعشار فارسی (٫ U+066B) و جداکننده‌ی هزارگان فارسی (٬ U+066C). */
const PERSIAN_DECIMAL_SEPARATOR = "٫";
const THOUSANDS_SEPARATORS = /[٬,\s]/g;

/** ارقام فارسی/عربی یک رشته را به لاتین برمی‌گرداند؛ بقیه‌ی نویسه‌ها دست‌نخورده می‌مانند. */
function toLatinDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const persianIndex = PERSIAN_DIGITS.indexOf(ch);
    if (persianIndex !== -1) {
      out += String(persianIndex);
      continue;
    }
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabicIndex !== -1) {
      out += String(arabicIndex);
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * رشته‌ی ورودی کاربر (وزن به گرم یا مبلغ به تومان) ⟸ عدد مثبت متناهی، یا
 * `null` اگر خالی/نامعتبر/صفر/منفی باشد. جداکننده‌ی هزارگان (٬ یا ,) نادیده
 * گرفته می‌شود؛ جداکننده‌ی اعشار فارسی (٫) هم‌ارز نقطه است.
 */
export function parseCalculatorInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const normalized = toLatinDigits(trimmed)
    .replace(THOUSANDS_SEPARATORS, "")
    .replace(PERSIAN_DECIMAL_SEPARATOR, ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * وزن (گرم) × قیمت واحد (تومان بر گرم) ⟸ مبلغ کل، گرد به نزدیک‌ترین تومان
 * (تومان کسری نمایش‌پذیر نیست — همان قاعده‌ی همه‌ی مبالغ نمایشی سایت).
 */
export function amountFromWeight(weightGrams: number, unitPriceToman: number): number {
  return Math.round(weightGrams * unitPriceToman);
}

/**
 * مبلغ (تومان) ÷ قیمت واحد ⟸ وزن (گرم)، گرد تا چهار رقم اعشار (برای حذف
 * نوفه‌ی اعشار شناور، نه کم کردن دقت واقعی). قیمت واحدِ نامعتبر (صفر/منفی/
 * نامتناهی) ⟸ `null` — سکوی بی‌قیمت چیزی برای تقسیم ندارد.
 */
export function weightFromAmount(amountToman: number, unitPriceToman: number): number | null {
  if (!Number.isFinite(unitPriceToman) || unitPriceToman <= 0) return null;
  const grams = amountToman / unitPriceToman;
  return Math.round(grams * 10_000) / 10_000;
}

/**
 * مبلغ نهایی طلای زینتی از روی قیمت گرم (بند ۸ سند طراحی).
 *
 * `وزن × قیمت × (۱ + اجرت) × (۱ + سود) × (۱ + مالیات)` — ترتیب مرسوم بازار:
 * اجرت روی قیمت طلا، سود روی مجموع طلا و اجرت، و مالیات روی کل. درصدِ
 * نداده‌شده صفر فرض می‌شود، نه «نامعتبر»: کاربری که فقط وزن را زده باید
 * قیمت خام طلا را ببیند، نه خط تیره.
 *
 * ⚠️ **این ناقض قاعده‌ی سخت ۱ نیست، به همان دلیلی که بالای این فایل نوشته
 * شده**: قاعده‌ی ۱ می‌گوید وب نباید قیمت **سکو** را بسازد یا مشتق کند. اینجا
 * هیچ قیمتی ساخته نمی‌شود — ورودی‌ها را خودِ کاربر می‌زند و خروجی هرگز ذخیره،
 * منتشر یا به سکویی منتسب نمی‌شود. این همان دسته‌ی `amountFromWeight` بالاست
 * که از پیش پذیرفته شده بود؛ فقط چند ضرب بیشتر دارد.
 *
 * ⚠️ عمداً اینجاست و نه داخل کامپوننت: این فایل «تنها دروازه»ی حساب ماشین‌حساب
 * است و تست خودش را دارد. فرمولی که داخل یک `.tsx` زندگی کند، بی‌تست می‌ماند.
 */
export function jewelryTotal(options: {
  weightGrams: number;
  pricePerGram: number;
  wagePercent: number;
  profitPercent: number;
  vatPercent: number;
}): number {
  const { weightGrams, pricePerGram, wagePercent, profitPercent, vatPercent } = options;
  const gold = weightGrams * pricePerGram;
  const withWage = gold * (1 + wagePercent / 100);
  const withProfit = withWage * (1 + profitPercent / 100);
  return Math.round(withProfit * (1 + vatPercent / 100));
}
