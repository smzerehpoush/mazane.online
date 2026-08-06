/**
 * منطق سوآپ به‌روزرسان زنده — بلیت ۸؛ تابع خالص و بدون DOM تا در مرز وب
 * تست‌پذیر باشد: «مقادیر فعلی DOM + ردیف payload ⟸ مقادیر جدید DOM».
 *
 * فقط متن قیمت و برچسب زمان/کهنگی عوض می‌شوند. ترتیب ردیف‌ها، دلتاها و
 * داده‌ی ساخت‌یافته (بلیت ۱۰) عمداً دست نمی‌خورند: بازمرتب‌سازی کلاینتی با
 * سمانتیک ترتیبِ سروررندر تناقض دارد؛ اگر ارزان‌ترین سکو عوض شود، ترتیب و
 * دلتا در رندر بعدی ISR (حداکثر ۶۰ ثانیه بعد) تازه می‌شوند — انتخاب عمدی
 * و مستند (بند ۶.۲ سند معماری).
 *
 * قطع منبع ⟸ کهنگی، نه خطا (قاعده‌ی ۵): payload بی‌قیمت متن قبلی را نگه
 * می‌دارد و فقط برچسب زمان از روی ISO موجود «پیر» می‌شود.
 */
import { formatMinutesAgoFa, isStale, minutesSince } from "./format";

/**
 * یک ردیف payload ‎GET /api/prices‎ — همان عدد نمایشی که رندر سرور در سلول
 * قیمت گذاشته؛ هیچ عدد یا فرمول تازه‌ای نیست. shape این قرارداد داخلی بین
 * route و به‌روزرسان است — مصرف‌کننده‌ی بیرونی ندارد.
 */
export interface LivePriceRow {
  platform_slug: string;
  /** مؤثر خرید (یا میانی برای کارمزد نامشخص) — همان انتخاب displayPriceToman سرور. */
  price_toman: number | null;
  /** رشته‌ی آماده‌ی نمایش با ارقام فارسی — دقیقاً همان قالب سلول قیمت صفحه. */
  price_display: string | null;
  updated_at: string | null;
}

export interface LivePricesPayload {
  generated_at: string;
  rows: LivePriceRow[];
}

/** وضعیت متنی یک ردیف در DOM — ورودی و خروجی تابع خالص سوآپ. */
export interface LiveRowDomState {
  /** متن گره‌ی ‎[data-live="price"]‎. */
  priceText: string;
  /** مقدار صفت ‎datetime‎ گره‌ی ‎[data-live="updated-at"]‎. */
  updatedAtIso: string | null;
  /** متن همان گره‌ی زمان. */
  updatedText: string;
  /** متن گره‌ی ‎[data-live="stale"]‎ — تهی یعنی تازه. */
  staleText: string;
}

/** پسوند کهنگی — عین همان رشته‌ای که رندر سرور می‌گذارد تا سوآپ نامرئی باشد. */
export const STALE_SUFFIX_FA = " (کهنه)";

/**
 * مقادیر جدید یک ردیف. قواعد:
 * - قیمت فقط وقتی عوض می‌شود که payload برای این سکو قیمت داشته باشد؛
 *   وگرنه عدد قبلی می‌ماند (کهنگی، نه خطا).
 * - برچسب زمان از تازه‌ترین ISO موجود (payload و در نبودش DOM) دوباره
 *   ساخته می‌شود — پس حتی بدون payload هم «۲ دقیقه پیش» درجا پیر می‌شود.
 * - بدون هیچ ISO (سکوی بی‌سابقه) هیچ چیز عوض نمی‌شود.
 */
export function nextRowDomState(
  current: LiveRowDomState,
  update: LivePriceRow | undefined,
  nowMs: number,
): LiveRowDomState {
  const priceText =
    update !== undefined && update.price_display !== null
      ? update.price_display
      : current.priceText;
  const updatedAtIso = update?.updated_at ?? current.updatedAtIso;
  if (updatedAtIso === null) {
    return { ...current, priceText };
  }
  const minutes = minutesSince(updatedAtIso, nowMs);
  return {
    priceText,
    updatedAtIso,
    updatedText: formatMinutesAgoFa(minutes),
    staleText: isStale(minutes) ? STALE_SUFFIX_FA : "",
  };
}
