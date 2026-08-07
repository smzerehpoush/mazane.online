/**
 * کارت نرخ صفحه‌ی سکو (بلیت ۲۷): عدد درشت قیمت مرجع سکو + نمودار ناحیه‌ای
 * روند ۲۴ ساعت گذشته، همیشه بازه‌ی روزانه (زبانه‌ی بازه مال بلیت ۳۰ است).
 *
 * ⚠️ قاعده‌ی ۱ قراردادها: عدد درشت مستقیماً `referencePriceFor` است — یک
 * انتخاب از اعداد آماده‌ی گردآورنده، نه محاسبه. برچسب زیرش هم از
 * `hasUnknownFee` مشتق می‌شود، نه فهرست دستی. نمودار همان سری تاریخچه‌ی
 * همین سکو را می‌کشد (`lib/history.ts`، دقیقاً الگوی نمودار چندسکویی صفحه‌ی
 * اصلی — `home-view.tsx::chartView`). سه آمار پایین کارت هم فقط از همین سری
 * بیرون کشیده می‌شوند: کمینه/بیشینه‌ی خالص و تفاضل سر و ته همان سری، دقیقاً
 * الگوی مجاز قاعده‌ی ۱ («آخرین نمونه، کمینه/بیشینه‌ی یک سری»)، نه یک فرمول
 * قیمتی تازه و نه میانگین بین‌سکویی (قاعده‌ی ۴) — سری فقط مال همین یک سکوست.
 *
 * قطع منبع تاریخچه یا سکوی بی‌سابقه ⟸ کارت بدون نمودار رندر می‌شود، صفحه
 * ۲۰۰ می‌ماند (قاعده‌ی ۵). سکوی بی‌قیمت مرجع (بی‌اسنپ‌شات یا فقط یک سمت باز)
 * اصلاً قیمت مرجع ندارد ⟸ کل کارت رندر نمی‌شود.
 *
 * جزء مستقل است: نمودار چندسکویی صفحه‌ی اصلی (`PriceChart.tsx`) دست‌نخورده
 * می‌ماند و این کارت هیچ چیزی از آن import نمی‌کند.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatDateTimeFa, formatSignedToman, formatToman } from "@/lib/format";
import type { HistoryPoint, PlatformHistory } from "@/lib/history";
import { hasUnknownFee, referencePriceFor, type Row } from "@/lib/rows";

const KNOWN_FEE_LABEL = "میانگین خرید و فروش این سکو";
const UNKNOWN_FEE_LABEL = "قیمت اعلامی این سکو";

interface RateStats {
  change: number;
  high: number;
  low: number;
}

/** فقط انتخاب: کمینه/بیشینه‌ی همان سری + تفاضل سر و ته همان سری. */
function computeStats(points: HistoryPoint[]): RateStats | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  return {
    change: (values[values.length - 1] as number) - (values[0] as number),
    high: Math.max(...values),
    low: Math.min(...values),
  };
}

function RateTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: HistoryPoint }[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (point === undefined) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      <div className="text-[11px] text-muted-foreground">{formatDateTimeFa(point.hour)}</div>
      <div className="mt-0.5 font-semibold tabular-nums">
        {formatToman(point.value)}{" "}
        <span className="text-[11px] font-normal text-muted-foreground">تومان</span>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums sm:text-sm">{children}</span>
    </div>
  );
}

function ChangeStat({ change }: { change: number }) {
  const tone = change > 0 ? "text-positive" : change < 0 ? "text-negative" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {change > 0 ? (
        <TrendingUp className="size-3.5" aria-hidden />
      ) : change < 0 ? (
        <TrendingDown className="size-3.5" aria-hidden />
      ) : null}
      {formatSignedToman(change)}
    </span>
  );
}

export function PlatformRateCard({
  row,
  history,
}: {
  row: Row;
  /** تاریخچه‌ی همین سکو — `null` یعنی منبع قطع بود یا سابقه‌ای نیست. */
  history: PlatformHistory | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const price = referencePriceFor(row, "GOLD_18K");
  const points = history?.points ?? [];
  const hasSeries = points.length > 0;
  const stats = useMemo(() => computeStats(points), [points]);

  // سکوی بی‌قیمت مرجع (بی‌اسنپ‌شات یا فقط یک سمت باز) ⟸ کل کارت رندر نمی‌شود.
  if (price === null) return null;

  const label = hasUnknownFee(row) ? UNKNOWN_FEE_LABEL : KNOWN_FEE_LABEL;

  return (
    <section
      aria-labelledby="rate-card-heading"
      className="glass-surface rise-in mb-6 px-5 py-5 sm:px-6"
    >
      <h2 id="rate-card-heading" className="text-base font-semibold sm:text-lg">
        قیمت مرجع سکو
      </h2>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <div data-rate-price className="text-3xl font-bold tabular-nums sm:text-4xl">
            {formatToman(price)}
            <span className="ms-2 text-sm font-normal text-muted-foreground">تومان</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>

        {hasSeries ? (
          <div dir="ltr" className="h-20 w-full sm:h-24">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="rate-card-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={<RateTooltip />}
                    cursor={{
                      stroke: "var(--color-ring)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rate-card-fill)"
                    isAnimationActive
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-xl bg-surface" />
            )}
          </div>
        ) : (
          <p className="text-xs leading-6 text-muted-foreground">
            هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.
          </p>
        )}
      </div>

      {stats !== null && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
          <Stat label="تغییرات">
            <ChangeStat change={stats.change} />
          </Stat>
          <Stat label="بالاترین">{formatToman(stats.high)}</Stat>
          <Stat label="پایین‌ترین">{formatToman(stats.low)}</Stat>
        </div>
      )}
    </section>
  );
}
