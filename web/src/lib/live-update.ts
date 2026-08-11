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
 *
 * `nextRateCardCountdown` (بلیت ۳۱) همان اصل را برای شمارنده‌ی «بروزرسانی
 * بعدی در N ثانیه» زیر کارت نرخ سکو تکرار می‌کند — تابع خالص جدا، بدون
 * تایمر. اثر جانبی (setInterval + fetch) در خودِ `PlatformRateCard.tsx` است.
 */
import { formatMinutesAgoFa, isStale, minutesSince } from "./format";

/**
 * یک ردیف payload ‎GET /api/prices‎ — همان عدد نمایشی که رندر سرور در سلول
 * قیمت گذاشته؛ هیچ عدد یا فرمول تازه‌ای نیست. shape این قرارداد داخلی بین
 * route و به‌روزرسان است — مصرف‌کننده‌ی بیرونی ندارد.
 */
export interface LivePriceRow {
  platform_slug: string;
  /** «قیمت» سکو پیش از کارمزد — همان انتخاب `priceToman` سرور. */
  price_toman: number | null;
  /** رشته‌ی آماده‌ی نمایش با ارقام فارسی — دقیقاً همان قالب سلول قیمت صفحه. */
  price_display: string | null;
  updated_at: string | null;
}

/**
 * وضعیت تازه‌ی یک منبع روی داشبورد — **همه‌چیز از قبل سمت سرور حساب و
 * قالب‌بندی شده** (بند ۱۴).
 *
 * ⚠️ به‌ویژه `rail_percent`: موقعیت روی محور به کمینه/بیشینه‌ی کل مجموعه
 * وابسته است، پس با هر نوبت عوض می‌شود. اگر کلاینت خودش حسابش می‌کرد، هم
 * قاعده‌ی سخت ۱ می‌شکست و هم دو پیاده‌سازی از یک هندسه داشتیم که می‌توانند
 * واگرا شوند. کلاینت فقط عدد را در `style.right` می‌نشاند.
 */
export interface LiveDashboardSource {
  slug: string;
  price_toman: number | null;
  price_display: string | null;
  rail_percent: number | null;
  stem_long: boolean;
  /**
   * زمان تازه‌ترین داده‌ی همین سکو — تا برچسب کهنگی کارت با گذر زمان پیر شود.
   * بدون این، سکویی که از کار افتاده عددش را روی صفحه نگه می‌داشت و هیچ‌وقت
   * «کهنه» نمی‌شد (قاعده‌ی سخت ۵).
   */
  updated_at: string | null;
}

/** هندسه و پاورقی تازه‌ی محور — همان چیزی که `buildDashboard` ساخته. */
export interface LiveDashboard {
  sources: LiveDashboardSource[];
  max_display: string | null;
  min_display: string | null;
  spread_display: string | null;
  reference_percent: number | null;
  /** تازه‌ترین زمان داده — مبنای ری‌ست فتیله (بند ۱۴). */
  updated_at: string | null;
  /**
   * همان زمان، ساعت تهران و آماده‌ی نشستن در DOM.
   *
   * ⚠️ رشته‌ی آماده می‌آید و کلاینت قالب‌بندی نمی‌کند — همان قاعده‌ای که کل
   * این payload بر آن بنا شده. بدون این فیلد، برچسب «آخرین به‌روزرسانی» روی
   * زمان رندر سرور یخ می‌زد در حالی که قیمت‌های کنارش هر ۳۰ ثانیه عوض
   * می‌شدند — یعنی دقیقاً همان برچسبی که کارش گفتن سن داده است، دروغ می‌گفت.
   */
  updated_at_display: string | null;
}

export interface LivePricesPayload {
  generated_at: string;
  rows: LivePriceRow[];
  /**
   * نمای داشبورد صفحه‌ی اصلی. اختیاری است تا مصرف‌کننده‌ی دیگر این اندپوینت
   * (`PlatformRateCard` صفحه‌ی سکو، که فقط `rows` را می‌خواند) به تغییر شکل
   * حساس نباشد.
   */
  dashboard?: LiveDashboard;
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

/**
 * ثانیه‌های یک نوبت شمارش معکوس کارت نرخ سکو (بلیت ۳۱) — همان بازه‌ی
 * polling صفحه‌ی اصلی («بروزرسانی بعدی در N ثانیه»، نه ۶۰).
 */
export const RATE_CARD_POLL_SECONDS = 30;

/** خروجی یک تیک شمارنده‌ی کارت نرخ — ثانیه‌ی بعدی + آیا الان باید دریافت واقعی انجام شود. */
export interface RateCardCountdownTick {
  secondsRemaining: number;
  shouldFetch: boolean;
}

/**
 * یک تیک ثانیه‌ای شمارنده‌ی «بروزرسانی بعدی در N ثانیه» زیر کارت نرخ (بلیت
 * ۳۱). تابع خالص، بدون تایمر/DOM/شبکه: «ثانیه‌های باقی‌مانده‌ی فعلی + آیا
 * همین الان کهنه‌ایم؟ ⟸ ثانیه‌های بعدی + آیا باید یک نوبت دریافت واقعی
 * ‎GET /api/prices‎ انجام شود؟».
 *
 * کهنگی شمارنده را خاموش می‌کند (معیار پذیرش تیکت): تا وقتی کهنه‌ایم هر تیک
 * همان RATE_CARD_POLL_SECONDS را برمی‌گرداند و هرگز دریافت درخواست نمی‌کند —
 * فقط برچسب کهنگی (Staleness) روی کارت می‌ماند. سالم که شد، شمارش از ۳۰ تا
 * صفر ادامه می‌یابد؛ درست در صفر یک نوبت دریافت واقعی لازم است و شمارنده
 * دوباره از ۳۰ شروع می‌شود.
 */
export function nextRateCardCountdown(
  secondsRemaining: number,
  isStaleNow: boolean,
): RateCardCountdownTick {
  if (isStaleNow) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: false };
  }
  if (secondsRemaining <= 0) {
    return { secondsRemaining: RATE_CARD_POLL_SECONDS, shouldFetch: true };
  }
  return { secondsRemaining: secondsRemaining - 1, shouldFetch: false };
}
