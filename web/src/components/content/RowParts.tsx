/**
 * تکه‌های مشترک ردیف صفحات محتوا — برچسب کهنگی، نشان دفتر سفارش، نشان‌های
 * باز/بسته و برچسب منبع کارمزد.
 *
 * منتقل‌شده از ‎app/row-parts.tsx‎ اپ نکست قبلی، با همان رفتار و همان قلاب‌های
 * ‎data-*‎؛ فقط استایل به توکن‌های طراحی تازه (Tailwind) رسیده است. هیچ فرمول
 * قیمتی اینجا نیست (قاعده‌ی ۱ قراردادها).
 */
import {
  formatDateFa,
  formatMinutesAgoFa,
  isStale,
  minutesSince,
} from "@/lib/format";
import { STALE_SUFFIX_FA } from "@/lib/live-update";
import type { ListedPlatform, PlatformTerms } from "@/lib/prices";

/**
 * برچسب زمان داخل خود HTML (الزام بند ۶.۲) با قلاب‌های ‎data-live‎ برای
 * به‌روزرسان زنده (بلیت ۸). گره‌ی کهنگی همیشه هست (وقتی تازه است تهی) تا سوآپ
 * کلاینت فقط متن عوض کند، نه ساختار DOM. در صفحات دارایی/سکو به‌روزرسان
 * mount نمی‌شود و این قلاب‌ها ایستا می‌مانند.
 *
 * `nowMs` از `generated_at` همان payload سرور می‌آید، نه `Date.now()` کلاینت —
 * پس متن سرور و کلاینت یکی است و هیدریشن واگرا نمی‌شود.
 */
export function Staleness({
  updatedAt,
  nowMs,
}: {
  updatedAt: string | null;
  nowMs: number;
}) {
  if (updatedAt === null) {
    // سکوی بی‌سابقه قلاب زنده ندارد — با آمدن اولین داده، رندر بعدی نشانش می‌دهد.
    return <span>هنوز داده‌ای ثبت نشده است</span>;
  }
  const minutes = minutesSince(updatedAt, nowMs);
  return (
    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
      به‌روزرسانی:{" "}
      <time dateTime={updatedAt} data-live="updated-at" suppressHydrationWarning>
        {formatMinutesAgoFa(minutes)}
      </time>
      <strong
        data-live="stale"
        className="font-medium text-negative"
        suppressHydrationWarning
      >
        {isStale(minutes) ? STALE_SUFFIX_FA : null}
      </strong>
    </span>
  );
}

export function FeeSourceLabel({ terms }: { terms: PlatformTerms }) {
  if (terms.fee_source === "MANUAL") {
    // کارمزد دستی باید برچسب و تاریخ مشاهده داشته باشد (بند ۲.۲ سند معماری).
    return (
      <span>
        دستی — مشاهده‌شده در{" "}
        <time dateTime={terms.observed_at}>{formatDateFa(terms.observed_at)}</time>
      </span>
    );
  }
  if (terms.fee_source === "UNKNOWN") {
    return <span>نامشخص — سکو کارمزدش را اعلام نکرده است</span>;
  }
  return <span>از API سکو</span>;
}

/**
 * برچسب صریح دفتر سفارش (بند ۹.۲، شکاف ۵ رقبا): قیمت داریک از سفارش‌های
 * کاربران است، نه قیمت‌گذاری فروشنده — بدون این برچسب، اسپرد ناهم‌جنس
 * به‌عنوان قیمت رقیب خوانده می‌شود.
 */
export function MarketModelBadge({ platform }: { platform: ListedPlatform }) {
  if (platform.market_model !== "ORDER_BOOK") return null;
  return (
    <span
      data-badge="order-book"
      title="قیمت این سکو از دفتر سفارش کاربران می‌آید؛ ممکن است نقدشوندگی محدود باشد و اسپردش با سکوهای فروشنده هم‌جنس نیست."
      className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground"
    >
      دفتر سفارش
    </span>
  );
}

/** نشان باز/بسته — از buy_enabled/sell_enabled داده‌ی زنده (بند ۹.۲). */
export function ClosedBadges({ terms }: { terms: PlatformTerms }) {
  return (
    <>
      {terms.buy_enabled ? null : (
        <strong
          data-badge="buy-closed"
          className="rounded-full bg-negative-soft px-2 py-0.5 text-[10px] font-medium text-negative"
        >
          خرید بسته است
        </strong>
      )}
      {terms.sell_enabled ? null : (
        <strong
          data-badge="sell-closed"
          className="rounded-full bg-negative-soft px-2 py-0.5 text-[10px] font-medium text-negative"
        >
          فروش بسته است
        </strong>
      )}
    </>
  );
}
