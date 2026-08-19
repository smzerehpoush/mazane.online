import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { RangeTabs } from "@/components/content/RangeTabs";
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
  nextRateCardPrice,
  RATE_CARD_POLL_SECONDS,
  type LivePricesPayload,
} from "@/lib/live-update";
import { priceToman, type Row } from "@/lib/rows";
import { seriesPaths } from "@/lib/spline";
import { fa, RATE_CARD_RANGES } from "@/lib/site-content";

const PRICE_LABEL = "قیمت اعلامی این سکو — پیش از کارمزد";
const NOT_ENOUGH_HISTORY_LABEL = "داده‌ی کافی ثبت نشده";

const EMPTY_HISTORY_MESSAGE: Record<HistoryRange, string> = {
  DAILY: "هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.",
  WEEKLY: "هنوز سابقه‌ی روند هفتگی برای این سکو ثبت نشده است.",
  MONTHLY: "هنوز سابقه‌ی روند ماهانه برای این سکو ثبت نشده است.",
};

interface RateStats {
  changeFraction: number;
  high: number;
  low: number;
}

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

function computeEnabledRanges(history: PlatformHistoryByRange): Record<HistoryRange, boolean> {
  const enabled = {} as Record<HistoryRange, boolean>;
  for (const range of RATE_CARD_RANGES) {
    enabled[range.key] =
      range.key === "DAILY" ? true : history[range.key]?.has_enough_coverage === true;
  }
  return enabled;
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

export function PlatformRateCard({
  row,
  history,
  nowMs,
}: {
  row: Row;
  history: PlatformHistoryByRange;
  nowMs: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeRange, setActiveRange] = useState<HistoryRange>("DAILY");

  const price = priceToman(row, "GOLD_18K");
  const serverPriceText = price === null ? "" : formatToman(price);

  const [live, setLive] = useState(() => ({
    updatedAtIso: row.updatedAt,
    nowMs,
    secondsRemaining: RATE_CARD_POLL_SECONDS,
    priceText: serverPriceText,
  }));

  useEffect(() => {
    let cancelled = false;
    let updatedAtIso = row.updatedAt;
    let priceText = serverPriceText;
    let secondsRemaining = RATE_CARD_POLL_SECONDS;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/prices", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as LivePricesPayload;
        const match = payload.rows.find((r) => r.platform_slug === row.platform.slug);
        priceText = nextRateCardPrice(priceText, match);
        if (match !== undefined && match.updated_at !== null) {
          updatedAtIso = match.updated_at;
        }
      } catch {
        // Network outage: keep the previous timestamp; staleness, not error.
      }
    }

    function tick(): void {
      if (cancelled) return;
      const now = Date.now();
      const staleNow = updatedAtIso === null || isStale(minutesSince(updatedAtIso, now));
      const next = nextRateCardCountdown(secondsRemaining, staleNow);
      secondsRemaining = next.secondsRemaining;
      setLive({ updatedAtIso, nowMs: now, secondsRemaining, priceText });
      if (next.shouldFetch) void refresh();
    }

    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [row.platform.slug, row.updatedAt, serverPriceText]);

  const enabledRanges = useMemo(() => computeEnabledRanges(history), [history]);
  const activeHistory = history[activeRange];
  const points = useMemo(() => activeHistory?.points ?? [], [activeHistory]);
  const hasSeries = points.length > 0;
  const stats = useMemo(() => computeStats(points), [points]);
  const shape = useMemo(
    () =>
      seriesPaths(
        points.map((point) => point.value),
        { width: 320, height: 96, padding: 4 },
      ),
    [points],
  );
  const [hovered, setHovered] = useState<HistoryPoint | null>(null);

  if (price === null) return null;

  const staleNow =
    live.updatedAtIso === null || isStale(minutesSince(live.updatedAtIso, live.nowMs));

  const label = PRICE_LABEL;

  return (
    <section aria-labelledby="rate-card-heading" className="card-surface rise-in px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rate-card-heading" className="text-base font-semibold sm:text-lg">
          قیمت سکو
        </h2>

        <RangeTabs
          active={activeRange}
          enabled={enabledRanges}
          onSelect={setActiveRange}
          ariaLabel="بازه‌ی نمودار"
          disabledLabel={NOT_ENOUGH_HISTORY_LABEL}
        />
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <div data-rate-price className="text-3xl font-bold tabular-nums sm:text-4xl">
            {live.priceText}
            <span className="ms-2 text-sm font-normal text-muted-foreground">تومان</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>

        {hasSeries ? (
          <div key={activeRange} dir="ltr" className="relative h-20 w-full sm:h-24">
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
