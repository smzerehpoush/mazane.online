/**
 * تم روشن/تاریک — قرارداد مشترک اسکریپت inline سرصفحه و دکمه‌ی تعویض.
 *
 * قاعده‌ها (بند ۲ و بند ۱۴ سند طراحی):
 *
 *   ۱. تم روی `<html>` با صفت `data-theme` می‌نشیند.
 *   ۲. بار اول `prefers-color-scheme` خوانده می‌شود.
 *   ۳. انتخاب دستی کاربر در `localStorage` ذخیره می‌شود و **بر سیستم مقدم
 *      است** — تا وقتی پاکش نکند.
 *   ۴. سرور **همیشه** `light` رندر می‌کند و اسکریپت inline پیش از نقاشیِ
 *      بدنه اصلاحش می‌کند. پس نه فلش سفید داریم و نه واگرایی hydration —
 *      ری‌اکت هرگز این صفت را نمی‌بیند که بخواهد سرش دعوا کند
 *      (`suppressHydrationWarning` روی همان `<html>`).
 *
 * ⚠️ چرا اسکریپت یک **رشته** است و نه یک ماژول import شده: باید پیش از هر
 * چیز دیگری اجرا شود، پس نمی‌تواند منتظر باندل بماند. همین‌جا کنار ثابت‌هایش
 * می‌ماند تا نام کلید و نام صفت در دو جا از هم واگرا نشوند.
 */

/** صفت روی `<html>`. هم‌نام با سلکتور دارک در `styles.css`. */
export const THEME_ATTRIBUTE = "data-theme";

/** کلید `localStorage`. پیشوند دامنه دارد تا با کلید سایت دیگری قاتی نشود. */
export const THEME_STORAGE_KEY = "tablo:theme";

export type Theme = "light" | "dark";

/**
 * تمی که سرور رندر می‌کند — **همیشه همین**، مستقل از کاربر.
 *
 * سرور نه `localStorage` دارد و نه `prefers-color-scheme` کاربر را می‌بیند
 * (هدر `Sec-CH-Prefers-Color-Scheme` نداریم و اگر داشتیم هم کش لبه را
 * چندبرابر می‌کرد — بند ۱۰ سند معماری). پس یک مقدار ثابت رندر می‌شود و
 * اصلاحش کار اسکریپت inline است.
 */
export const SERVER_THEME: Theme = "light";

/**
 * اسکریپت inline سرصفحه. سه ویژگی اجباری دارد:
 *
 *   - **همگام** — هیچ `async`/`defer`ی ندارد، وگرنه فلش رخ می‌دهد.
 *   - **بدون وابستگی** — پیش از هر باندلی اجرا می‌شود.
 *   - **بی‌صدا در خطا** — `localStorage` در حالت ناشناس بعضی مرورگرها
 *     پرتاب می‌کند؛ تم غلط بی‌نهایت بهتر از صفحه‌ی سفید است.
 *
 * فقط وقتی `dark` می‌نشاند که لازم باشد: سرور از قبل `light` گذاشته.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);}catch(e){}})();`;

/** تم فعلی از روی DOM — تنها منبع حقیقت بعد از mount. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "dark" : "light";
}

/**
 * نشاندن تم + ذخیره‌ی انتخاب.
 *
 * ذخیره ممکن است شکست بخورد (حالت ناشناس، سهمیه‌ی پر). آن‌وقت تم همین نشست
 * اعمال می‌شود ولی یادش نمی‌ماند — رفتار درست است، نه خطا.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ذخیره‌ی ترجیح از دست رفت؛ خودِ تم اعمال شده.
  }
}

/** آیا کاربر تا حالا دستی انتخاب کرده؟ اگر نه، تم سیستم هنوز حاکم است. */
export function hasStoredPreference(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light";
  } catch {
    return false;
  }
}
