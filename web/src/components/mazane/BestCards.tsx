/**
 * دو کارت بالای جدول — «بهترین خرید» (کمترین قیمت مؤثر خرید) و «بهترین
 * فروش» (بیشترین قیمت مؤثر فروش).
 *
 * ⚠️ قاعده‌ی ۴: اینها **انتخاب**اند، نه میانگین. هر عدد با نام سکوی صاحبش
 * منتشر می‌شود و هیچ عدد بی‌صاحبی روی صفحه نیست. خودِ انتخاب در
 * `home-view.bestView` انجام شده؛ اینجا فقط قالب است.
 *
 * ⚠️ **رقم قیمت هرگز انیمیت نمی‌شود.** پیش‌تر یک شمارنده‌ی صعودی رقم را از
 * ~۹۷٪ مقدار واقعی بالا می‌آورد؛ یعنی برای ~۱٫۱ ثانیه پس از hydration عددی
 * روی صفحه بود که **هیچ سکویی اعلامش نکرده بود** — نقض قاعده‌ی ۱ (هیچ عدد
 * ساخته‌ی وب) و قاعده‌ی ۴ (هر عدد منتشرشده منتسب به یک سکو). حرکت فقط روی
 * محفظه است (`rise-in`)، نه روی رقم؛ متن رقم از رندر سرور تا همیشه یکی
 * می‌ماند و به همین دلیل `suppressHydrationWarning` هم لازم ندارد.
 */
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import type { BestPair, BestView } from "./home-view";
import { fa } from "@/lib/site-content";

type Tone = "positive" | "negative";

function BestCard({
  title,
  hint,
  best,
  Icon,
  tone,
}: {
  title: string;
  hint: string;
  best: BestView;
  Icon: typeof ArrowDownLeft;
  tone: Tone;
}) {
  const isPositive = tone === "positive";

  return (
    <div
      data-best={tone === "positive" ? "buy" : "sell"}
      data-platform-best={best.slug}
      className="lift-hover rise-in relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl"
      style={{
        backgroundColor: `color-mix(in oklab, var(--${isPositive ? "positive" : "negative"}-soft) 62%, var(--card))`,
        borderColor: `color-mix(in oklab, var(--${isPositive ? "positive" : "negative"}) 22%, transparent)`,
        boxShadow: `var(--shadow-glass), 0 18px 44px -30px color-mix(in oklab, var(--${isPositive ? "positive" : "negative"}) 60%, transparent)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 size-40 rounded-full blur-3xl"
        style={{
          background: `color-mix(in oklab, var(--${isPositive ? "positive" : "negative"}) 18%, transparent)`,
        }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span
          className="grid size-8 place-items-center rounded-full"
          style={{
            backgroundColor: `color-mix(in oklab, var(--${isPositive ? "positive" : "negative"}) 14%, transparent)`,
            color: `var(--${isPositive ? "positive" : "negative"})`,
          }}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="relative mt-4 text-lg font-semibold">{best.name}</div>
      <div
        data-best-price
        className="relative mt-1 text-2xl font-bold tabular-nums sm:text-3xl"
        style={{ color: `var(--${isPositive ? "positive" : "negative"})` }}
      >
        {fa(best.priceToman)}
        <span className="ms-2 text-xs font-normal text-muted-foreground">تومان</span>
      </div>
      <p className="relative mt-2 text-[11px] text-muted-foreground">
        {hint} در میان سکوهایی که کارمزدشان معلوم است
      </p>
    </div>
  );
}

/**
 * هیچ سکوی با کارمزد معلومی قیمت ندارد ⟸ هیچ کارتی رندر نمی‌شود. کارت خالی
 * نمی‌گذاریم و عدد جعل نمی‌کنیم؛ جدول پایین همچنان کار خودش را می‌کند.
 */
export function BestCards({ best }: { best: BestPair }) {
  if (best.buy === null && best.sell === null) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {best.buy !== null && (
        <BestCard
          title="بهترین خرید"
          hint="کمترین قیمت مؤثر خرید"
          best={best.buy}
          Icon={ArrowDownLeft}
          tone="positive"
        />
      )}
      {best.sell !== null && (
        <BestCard
          title="بهترین فروش"
          hint="بیشترین قیمت مؤثر فروش"
          best={best.sell}
          Icon={ArrowUpRight}
          tone="negative"
        />
      )}
    </div>
  );
}
