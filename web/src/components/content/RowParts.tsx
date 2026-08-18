import { formatDateFa, formatMinutesAgoFa, isStale, minutesSince } from "@/lib/format";
import { STALE_SUFFIX_FA } from "@/lib/live-update";
import type { ListedPlatform, PlatformTerms } from "@/lib/prices";
import { FEES_UNDISCLOSED_FA } from "@/lib/undisclosed";

export function Staleness({ updatedAt, nowMs }: { updatedAt: string | null; nowMs: number }) {
  if (updatedAt === null) {
    return <span>هنوز داده‌ای ثبت نشده است</span>;
  }
  const minutes = minutesSince(updatedAt, nowMs);
  return (
    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
      به‌روزرسانی:{" "}
      <time dateTime={updatedAt} data-live="updated-at" suppressHydrationWarning>
        {formatMinutesAgoFa(minutes)}
      </time>
      <strong data-live="stale" className="font-medium text-negative" suppressHydrationWarning>
        {isStale(minutes) ? STALE_SUFFIX_FA : null}
      </strong>
    </span>
  );
}

export function FeeSourceLabel({ terms }: { terms: PlatformTerms }) {
  if (terms.fee_source === "MANUAL") {
    return (
      <span>
        دستی — مشاهده‌شده در{" "}
        <time dateTime={terms.observed_at}>{formatDateFa(terms.observed_at)}</time>
      </span>
    );
  }
  if (terms.fee_source === "UNKNOWN") {
    return <span>{FEES_UNDISCLOSED_FA}</span>;
  }
  return <span>از API سکو</span>;
}

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
