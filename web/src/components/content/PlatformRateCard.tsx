/**
 * کارت نرخ صفحه‌ی سکو (بلیت ۲۷ + نوار زبانه‌ی بازه، بلیت ۳۰): عدد درشت
 * قیمت مرجع سکو + نمودار ناحیه‌ای روند، با سه بازه‌ی قابل‌انتخاب —
 * روزانه/هفتگی/ماهانه.
 *
 * ⚠️ قاعده‌ی ۱ قراردادها: عدد درشت مستقیماً `referencePriceFor` است — یک
 * انتخاب از اعداد آماده‌ی گردآورنده، نه محاسبه؛ همیشه «الان» است و با تعویض
 * زبانه عوض نمی‌شود (فقط نمودار و سه آمار زیرش تاریخی‌اند). برچسب زیرش هم از
 * `hasUnknownFee` مشتق می‌شود، نه فهرست دستی. نمودار هر زبانه سری تاریخچه‌ی
 * همان بازه‌ی همین سکو را می‌کشد (`lib/history.ts`، الگوی نمودار چندسکویی
 * صفحه‌ی اصلی — `home-view.tsx::chartView`، فقط تک‌سکو و سه‌بازه). سه آمار
 * پایین کارت هم فقط از همان سری بیرون کشیده می‌شوند: کمینه/بیشینه‌ی خالص و
 * تفاضل سر و ته همان سری، دقیقاً الگوی مجاز قاعده‌ی ۱ («آخرین نمونه،
 * کمینه/بیشینه‌ی یک سری»)، نه یک فرمول قیمتی تازه و نه میانگین بین‌سکویی
 * (قاعده‌ی ۴) — سری فقط مال همین یک سکوست. گام نمونه‌برداری هفتگی/ماهانه
 * (بدون میانگین) سمت سرور است (`lib/server/history-source.ts`).
 *
 * **دروازه‌ی «به‌زودی»**: زبانه‌ی هفتگی/ماهانه از `history[range].has_enough_coverage`
 * می‌خواند — سمت سرور محاسبه شده (نیمی از سطل‌های پنجره نمونه‌ی واقعی
 * داشته‌اند یا نه). پوشش کم یا منبع قطع، هر دو یک نتیجه دارند: زبانه
 * غیرفعال با برچسب «به‌زودی»، بدون throw (قاعده‌ی ۵). زبانه‌ی روزانه همیشه
 * فعال است.
 *
 * قطع منبع تاریخچه یا سکوی بی‌سابقه ⟸ کارت بدون نمودار رندر می‌شود، صفحه
 * ۲۰۰ می‌ماند (قاعده‌ی ۵). سکوی بی‌قیمت مرجع (بی‌اسنپ‌شات یا فقط یک سمت باز)
 * اصلاً قیمت مرجع ندارد ⟸ کل کارت رندر نمی‌شود.
 *
 * جزء مستقل است: نمودار چندسکویی صفحه‌ی اصلی (`PriceChart.tsx`) دست‌نخورده
 * می‌ماند و این کارت هیچ چیزی از آن import نمی‌کند.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatDateTimeFa, formatSignedToman, formatToman } from "@/lib/format";
import type { HistoryPoint, HistoryRange, PlatformHistoryByRange } from "@/lib/history";
import { hasUnknownFee, referencePriceFor, type Row } from "@/lib/rows";
import { RATE_CARD_RANGES, type RateCardRangeConfig } from "@/lib/site-content";

const KNOWN_FEE_LABEL = "میانگین خرید و فروش این سکو";
const UNKNOWN_FEE_LABEL = "قیمت اعلامی این سکو";
const COMING_SOON_LABEL = "به‌زودی";

/** پیام «سابقه ندارد» — روزانه دقیقاً متن قبل از بلیت ۳۰ می‌ماند. */
const EMPTY_HISTORY_MESSAGE: Record<HistoryRange, string> = {
  DAILY: "هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.",
  WEEKLY: "هنوز سابقه‌ی روند هفتگی برای این سکو ثبت نشده است.",
  MONTHLY: "هنوز سابقه‌ی روند ماهانه برای این سکو ثبت نشده است.",
};

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

/** روزانه همیشه فعال است؛ هفتگی/ماهانه فقط با پوشش کافی (سمت سرور محاسبه‌شده). */
function computeEnabledRanges(history: PlatformHistoryByRange): Record<HistoryRange, boolean> {
  const enabled = {} as Record<HistoryRange, boolean>;
  for (const range of RATE_CARD_RANGES) {
    enabled[range.key] =
      range.key === "DAILY" ? true : history[range.key]?.has_enough_coverage === true;
  }
  return enabled;
}

/** اولین زبانه‌ی فعال در جهت داده‌شده، با چرخش — زبانه‌های «به‌زودی» رد می‌شوند. */
function nextEnabledIndex(
  start: number,
  direction: 1 | -1,
  enabled: readonly boolean[],
): number {
  const n = enabled.length;
  for (let step = 1; step <= n; step++) {
    const index = (start + direction * step + n * n) % n;
    if (enabled[index] === true) return index;
  }
  return start;
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

/**
 * یک زبانه‌ی نوار بازه. فعال: قرص توپر تیره متن سفید. غیرفعال («به‌زودی»):
 * کم‌رنگ، بی‌کلیک، خارج از پیمایش Tab (`disabled` بومی همین کار را می‌کند).
 */
function RangeTab({
  range,
  active,
  enabled,
  onSelect,
  onKeyDown,
  tabRef,
}: {
  range: RateCardRangeConfig;
  active: boolean;
  enabled: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  tabRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={!enabled}
      disabled={!enabled}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`transition-smooth rounded-full px-3 py-1.5 text-xs font-medium ${
        !enabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {enabled ? range.label : COMING_SOON_LABEL}
    </button>
  );
}

export function PlatformRateCard({
  row,
  history,
}: {
  row: Row;
  /** تاریخچه‌ی هر سه بازه‌ی همین سکو — هرکدام `null` یعنی منبع قطع بود یا سابقه‌ای نیست. */
  history: PlatformHistoryByRange;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeRange, setActiveRange] = useState<HistoryRange>("DAILY");
  const tabRefs = useRef<Partial<Record<HistoryRange, HTMLButtonElement | null>>>({});

  const price = referencePriceFor(row, "GOLD_18K");
  const enabledRanges = useMemo(() => computeEnabledRanges(history), [history]);
  const activeHistory = history[activeRange];
  const points = activeHistory?.points ?? [];
  const hasSeries = points.length > 0;
  const stats = useMemo(() => computeStats(points), [points]);

  // سکوی بی‌قیمت مرجع (بی‌اسنپ‌شات یا فقط یک سمت باز) ⟸ کل کارت رندر نمی‌شود.
  if (price === null) return null;

  const label = hasUnknownFee(row) ? UNKNOWN_FEE_LABEL : KNOWN_FEE_LABEL;

  function selectRange(range: HistoryRange): void {
    if (enabledRanges[range] !== true) return; // زبانه‌ی «به‌زودی» بی‌کلیک است
    setActiveRange(range);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const order = RATE_CARD_RANGES.map((range) => range.key);
    const enabledFlags = order.map((key) => enabledRanges[key] === true);
    const currentIndex = order.indexOf(activeRange);

    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") targetIndex = nextEnabledIndex(currentIndex, 1, enabledFlags);
    else if (event.key === "ArrowLeft") targetIndex = nextEnabledIndex(currentIndex, -1, enabledFlags);
    else if (event.key === "Home") targetIndex = enabledFlags.indexOf(true);
    else if (event.key === "End") targetIndex = enabledFlags.lastIndexOf(true);
    if (targetIndex === null || targetIndex < 0) return;

    event.preventDefault();
    const targetRange = order[targetIndex] as HistoryRange;
    setActiveRange(targetRange);
    tabRefs.current[targetRange]?.focus();
  }

  return (
    <section
      aria-labelledby="rate-card-heading"
      className="glass-surface rise-in mb-6 px-5 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rate-card-heading" className="text-base font-semibold sm:text-lg">
          قیمت مرجع سکو
        </h2>

        <div
          role="tablist"
          aria-label="بازه‌ی نمودار"
          className="flex items-center gap-1 rounded-full bg-surface p-1"
        >
          {RATE_CARD_RANGES.map((range) => (
            <RangeTab
              key={range.key}
              range={range}
              active={activeRange === range.key}
              enabled={enabledRanges[range.key] === true}
              onSelect={() => selectRange(range.key)}
              onKeyDown={handleTabKeyDown}
              tabRef={(el) => {
                tabRefs.current[range.key] = el;
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <div data-rate-price className="text-3xl font-bold tabular-nums sm:text-4xl">
            {formatToman(price)}
            <span className="ms-2 text-sm font-normal text-muted-foreground">تومان</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>

        {hasSeries ? (
          <div key={activeRange} dir="ltr" className="h-20 w-full sm:h-24">
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
            {EMPTY_HISTORY_MESSAGE[activeRange]}
          </p>
        )}
      </div>

      {stats !== null && (
        // aria-live: تعویض زبانه همین سه عدد را عوض می‌کند؛ صفحه‌خوان باید
        // بی‌آنکه دوباره کل کارت را بخواند، مقدار تازه را اعلام کند.
        <div
          key={activeRange}
          aria-live="polite"
          aria-atomic="true"
          className="rise-in mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3"
        >
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
