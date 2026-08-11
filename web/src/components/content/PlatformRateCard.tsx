/**
 * کارت نرخ صفحه‌ی سکو (بلیت ۲۷ + نوار زبانه‌ی بازه، بلیت ۳۰): عدد درشت
 * «قیمت» سکو + نمودار ناحیه‌ای روند، با سه بازه‌ی قابل‌انتخاب —
 * روزانه/هفتگی/ماهانه.
 *
 * ⚠️ قاعده‌ی ۱ قراردادها: عدد درشت مستقیماً `priceToman` است — یک انتخاب از
 * اعداد آماده‌ی گردآورنده، نه محاسبه؛ همیشه «الان» است و با تعویض زبانه عوض
 * نمی‌شود (فقط نمودار و سه آمار زیرش تاریخی‌اند). برچسب زیرش دیگر شرطی نیست:
 * از وقتی قیمت مؤثر حذف شد (سند تصمیم ۰۰۰۲) عدد همه‌ی سکوها یک چیز است —
 * قیمت اعلامی خودشان، پیش از کارمزد. نمودار هر زبانه سری تاریخچه‌ی
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
 *
 * **شمارنده‌ی زنده + برچسب کهنگی (بلیت ۳۱)**: پایین کارت «بروزرسانی بعدی در
 * N ثانیه» را نشان می‌دهد — شمارش معکوس همان ۳۰ ثانیه‌ی
 * `live-prices-updater.tsx`، ولی مکانیزم مستقل خودش را دارد چون
 * `LivePricesUpdater` فقط در صفحه‌ی اصلی mount می‌شود و روی
 * ‎tr[data-platform]‎ کار می‌کند، نه این کارت. منطق تیک شمارنده تابع خالص
 * `nextRateCardCountdown` (کنار `nextRowDomState` در `lib/live-update.ts`)
 * است؛ اثر جانبی‌اش (setInterval + fetch) فقط همین‌جاست.
 *
 * ⚠️ عدد درشت کارت هرگز با این شمارنده عوض نمی‌شود — همچنان همان
 * `referencePriceFor` سروررندر می‌ماند (بند بالا). دریافت زنده فقط
 * `updated_at` همین سکو را از ‎/api/prices‎ می‌گیرد تا برچسب «آخرین
 * به‌روزرسانی»/کهنگی با گذر زمان واقعی پیش برود — نه قیمتی تازه، چون
 * ‎/api/prices‎ عدد «مؤثر خرید» را می‌دهد که تعریفش با «قیمت مرجع سکو» فرق
 * دارد؛ سوآپش اینجا برچسب کارت را روی عدد غلط می‌گذاشت.
 *
 * کهنگی شمارنده را خاموش می‌کند (`isStale` از `lib/format.ts`): فقط برچسب
 * Staleness می‌ماند، بدون هیچ شمارش. قطع شبکه/endpoint ⟸ زمان قبلی می‌ماند
 * (کهنگی، نه خطا، قاعده‌ی ۵) — دقیقاً همان قرارداد `nextRowDomState`.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Staleness } from "@/components/content/RowParts";
import {
  formatDateTimeFa,
  formatSignedPercentFa,
  formatToman,
  isStale,
  minutesSince,
} from "@/lib/format";
import type { HistoryPoint, HistoryRange, PlatformHistoryByRange } from "@/lib/history";
import {
  nextRateCardCountdown,
  RATE_CARD_POLL_SECONDS,
  type LivePricesPayload,
} from "@/lib/live-update";
import { priceToman, type Row } from "@/lib/rows";
import { seriesPaths } from "@/lib/spline";
import { fa, RATE_CARD_RANGES, type RateCardRangeConfig } from "@/lib/site-content";

const PRICE_LABEL = "قیمت اعلامی این سکو — پیش از کارمزد";
const COMING_SOON_LABEL = "به‌زودی";

/** پیام «سابقه ندارد» — روزانه دقیقاً متن قبل از بلیت ۳۰ می‌ماند. */
const EMPTY_HISTORY_MESSAGE: Record<HistoryRange, string> = {
  DAILY: "هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.",
  WEEKLY: "هنوز سابقه‌ی روند هفتگی برای این سکو ثبت نشده است.",
  MONTHLY: "هنوز سابقه‌ی روند ماهانه برای این سکو ثبت نشده است.",
};

interface RateStats {
  /** کسر تغییر سر و ته سری (مثلاً ۰٫۰۰۷۱ یعنی +۰٫۷۱٪) — سند مادر: «تغییرات با درصد و فلش». */
  changeFraction: number;
  high: number;
  low: number;
}

/**
 * فقط انتخاب و یک تقسیم روی همان سری: کمینه/بیشینه‌ی خالص + کسر تفاضل سر و ته
 * نسبت به نقطه‌ی اول (نه فرمول قیمتی تازه‌ای — تعریف «درصد تغییر» یک سری است،
 * نه کارمزد یا قیمت مؤثر؛ همان دسته‌ی مجاز کمینه/بیشینه‌ی بند بالای فایل).
 * نقطه‌ی اول صفر (عملاً هرگز برای قیمت طلا) ⟸ صفر، نه تقسیم بر صفر.
 */
function computeStats(points: HistoryPoint[]): RateStats | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const first = values[0] as number;
  const last = values[values.length - 1] as number;
  return {
    changeFraction: first === 0 ? 0 : (last - first) / first,
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
function nextEnabledIndex(start: number, direction: 1 | -1, enabled: readonly boolean[]): number {
  const n = enabled.length;
  for (let step = 1; step <= n; step++) {
    const index = (start + direction * step + n * n) % n;
    if (enabled[index] === true) return index;
  }
  return start;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums sm:text-sm">{children}</span>
    </div>
  );
}

function ChangeStat({ changeFraction }: { changeFraction: number }) {
  const tone =
    changeFraction > 0
      ? "text-positive"
      : changeFraction < 0
        ? "text-negative"
        : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {changeFraction > 0 ? (
        <TrendingUp className="size-3.5" aria-hidden />
      ) : changeFraction < 0 ? (
        <TrendingDown className="size-3.5" aria-hidden />
      ) : null}
      {formatSignedPercentFa(changeFraction)}
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
  nowMs,
}: {
  row: Row;
  /** تاریخچه‌ی هر سه بازه‌ی همین سکو — هرکدام `null` یعنی منبع قطع بود یا سابقه‌ای نیست. */
  history: PlatformHistoryByRange;
  /** مبنای «آخرین به‌روزرسانی» پیش از mount — از generated_at سرور (همان الگوی PlatformPage). */
  nowMs: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeRange, setActiveRange] = useState<HistoryRange>("DAILY");
  const tabRefs = useRef<Partial<Record<HistoryRange, HTMLButtonElement | null>>>({});

  // بلیت ۳۱: شمارنده + برچسب کهنگی — مقدار اولیه دقیقاً همان چیزی که سرور
  // با نوشتن دستی محاسبه می‌کرد، تا هیدریشن واگرا نشود؛ فقط بعد از mount
  // تیک می‌خورد (پایین‌تر).
  const [live, setLive] = useState(() => ({
    updatedAtIso: row.updatedAt,
    nowMs,
    secondsRemaining: RATE_CARD_POLL_SECONDS,
  }));

  useEffect(() => {
    let cancelled = false;
    let updatedAtIso = row.updatedAt;
    let secondsRemaining = RATE_CARD_POLL_SECONDS;

    // دریافت واقعی در صفر — فقط زمان همین سکو را تازه می‌کند، نه عدد درشت
    // کارت (بند بالای فایل): ‎/api/prices‎ «مؤثر خرید» می‌دهد که تعریفش با
    // «قیمت مرجع سکو» فرق دارد.
    async function refreshUpdatedAt(): Promise<void> {
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as LivePricesPayload;
        const match = payload.rows.find((r) => r.platform_slug === row.platform.slug);
        if (match !== undefined && match.updated_at !== null) {
          updatedAtIso = match.updated_at;
        }
      } catch {
        // قطع شبکه ⟸ زمان قبلی می‌ماند، کهنگی نه خطا (قاعده‌ی ۵)
      }
    }

    function tick(): void {
      if (cancelled) return;
      const now = Date.now();
      const staleNow = updatedAtIso === null || isStale(minutesSince(updatedAtIso, now));
      const next = nextRateCardCountdown(secondsRemaining, staleNow);
      secondsRemaining = next.secondsRemaining;
      setLive({ updatedAtIso, nowMs: now, secondsRemaining });
      if (next.shouldFetch) void refreshUpdatedAt();
    }

    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [row.platform.slug, row.updatedAt]);

  const price = priceToman(row, "GOLD_18K");
  const enabledRanges = useMemo(() => computeEnabledRanges(history), [history]);
  const activeHistory = history[activeRange];
  // useMemo هم اینجا: بی‌آن، فالبک `?? []` هر رندر یک آرایه‌ی تازه می‌سازد و
  // useMemo زیرِ stats را با هر رندر (نه فقط با عوض‌شدن واقعی داده) دوباره
  // حساب می‌کند.
  const points = useMemo(() => activeHistory?.points ?? [], [activeHistory]);
  const hasSeries = points.length > 0;
  const stats = useMemo(() => computeStats(points), [points]);
  // مسیر SVG سمت سرور ساخته می‌شود — همان ماژول مشترکی که اسپارک‌لاین
  // کارت‌های منبع و نمودار خلاصه بازار هم از آن استفاده می‌کنند.
  const shape = useMemo(
    () =>
      seriesPaths(
        points.map((point) => point.value),
        { width: 320, height: 96, padding: 4 },
      ),
    [points],
  );
  const [hovered, setHovered] = useState<HistoryPoint | null>(null);

  // سکوی بی‌قیمت (بی‌اسنپ‌شات، یا دفتر سفارشِ یک‌سمته) ⟸ کل کارت رندر نمی‌شود.
  if (price === null) return null;

  // کهنگی شمارنده را خاموش می‌کند — فقط برچسب Staleness زیر کارت می‌ماند.
  const staleNow =
    live.updatedAtIso === null || isStale(minutesSince(live.updatedAtIso, live.nowMs));

  const label = PRICE_LABEL;

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
    else if (event.key === "ArrowLeft")
      targetIndex = nextEnabledIndex(currentIndex, -1, enabledFlags);
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
      className="glass-surface rise-in px-5 py-5 sm:px-6"
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
          <div key={activeRange} dir="ltr" className="relative h-20 w-full sm:h-24">
            {/*
              ⚠️ SVG دستی، نه ریچارتس. سه سود مستقیم دارد:
                ۱. **سروررندر می‌شود** — پیش از این پشت `mounted` بود و تا
                   hydration جعبه‌ی خالی می‌ماند (ResponsiveContainer ابعاد
                   واقعی می‌خواهد). حالا در همان HTML اولیه است.
                ۲. کل وابستگی `recharts` از پروژه حذف شد — ۳۵۵KB خام که
                   **هر صفحه** دانلودش می‌کرد، چون در چانک مشترک نشسته بود.
                ۳. یک پیاده‌سازی نمودار در کل سایت (`lib/spline.ts`)، نه دو تا.
            */}
            <svg
              aria-hidden
              viewBox="0 0 320 96"
              preserveAspectRatio="none"
              className="block h-full w-full"
            >
              <defs>
                <linearGradient id="rate-card-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={shape.area ?? ""} fill="url(#rate-card-fill)" />
              <path
                d={shape.line ?? ""}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {/*
              خواندنِ نقطه‌ی زیر نشانگر — جانشین Tooltip ریچارتس. فقط بعد از
              mount فعال است و روی موبایل (بدون hover) هم چیزی را از بین
              نمی‌برد: سه آمار زیر کارت همان اطلاعات را متنی می‌دهند (بند ۱۲).
            */}
            {mounted && (
              <div
                className="absolute inset-0"
                onMouseLeave={() => setHovered(null)}
                onMouseMove={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  const ratio = (event.clientX - box.left) / box.width;
                  const index = Math.round(ratio * (points.length - 1));
                  setHovered(points[Math.min(Math.max(index, 0), points.length - 1)] ?? null);
                }}
              />
            )}
            {hovered !== null && (
              <div
                dir="rtl"
                className="pointer-events-none absolute top-0 right-0 rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-lift backdrop-blur"
              >
                <div className="text-[11px] text-muted-foreground">
                  {formatDateTimeFa(hovered.hour)}
                </div>
                <div className="mt-0.5 font-semibold tabular-nums">
                  {formatToman(hovered.value)}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">تومان</span>
                </div>
              </div>
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
            <ChangeStat changeFraction={stats.changeFraction} />
          </Stat>
          <Stat label="بالاترین">{formatToman(stats.high)}</Stat>
          <Stat label="پایین‌ترین">{formatToman(stats.low)}</Stat>
        </div>
      )}

      {/* بلیت ۳۱: برچسب «آخرین به‌روزرسانی» همیشه حاضر است؛ شمارنده فقط
          وقتی سالمیم کنارش می‌آید — کهنگی خاموشش می‌کند. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Staleness updatedAt={live.updatedAtIso} nowMs={live.nowMs} />
        {staleNow ? null : (
          <span data-rate-countdown className="text-[10px] text-muted-foreground/70">
            بروزرسانی بعدی در {fa(live.secondsRemaining)} ثانیه
          </span>
        )}
      </div>
    </section>
  );
}
