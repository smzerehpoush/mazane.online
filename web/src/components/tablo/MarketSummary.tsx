/**
 * ⚠️ **This card is not an average.** The initial design wanted a
 * "five-source average"; a cross-platform average is a legal red line and
 * is never computed or published. All four numbers and the series itself
 * belong to the named **reference source**, and the label under the big number
 * names it explicitly —
 * ⚠️ Data for **all three ranges** comes from the server
 * (`assembleHomeData`), so switching tabs does no fetch at all and just
 * swaps between three ready-made objects. Its size is negligible: the
 * longest range (monthly) has 93 points, and all three together don't add
 * up to a few kilobytes — this was measured before the decision was made.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { SummaryRange, SummaryView } from "@/lib/dashboard";
import type { HistoryRange } from "@/lib/history";
import { TomanPrice } from "./TomanPrice";

function nextEnabledIndex(start: number, direction: 1 | -1, ranges: SummaryRange[]): number {
  const count = ranges.length;
  for (let step = 1; step <= count; step++) {
    const index = (start + direction * step + count * count) % count;
    if (ranges[index]?.enabled === true) return index;
  }
  return start;
}

function ChangeStat({ range }: { range: SummaryRange }) {
  if (range.changeFraction === null) return <span className="text-tx3">—</span>;
  const up = range.changeFraction > 0;
  const down = range.changeFraction < 0;
  return (
    <span
      data-summary-change
      className={`inline-flex items-center gap-1 ${
        up ? "text-gn" : down ? "text-rd" : "text-muted-foreground"
      }`}
    >
      {up && <TrendingUp aria-hidden className="size-3.5" />}
      {down && <TrendingDown aria-hidden className="size-3.5" />}
      {range.changeDisplay}
    </span>
  );
}

export function MarketSummary({ summary }: { summary: SummaryView }) {
  const ranges = summary.ranges;
  const firstEnabled = ranges.findIndex((range) => range.enabled);
  const [activeKey, setActiveKey] = useState<HistoryRange>(
    () => ranges[firstEnabled === -1 ? 0 : firstEnabled]?.key ?? "DAILY",
  );
  const tabRefs = useRef<Partial<Record<HistoryRange, HTMLButtonElement | null>>>({});

  const active = ranges.find((range) => range.key === activeKey) ?? ranges[0];
  if (active === undefined) return null;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const current = ranges.findIndex((range) => range.key === activeKey);
    let target: number | null = null;
    if (event.key === "ArrowRight") target = nextEnabledIndex(current, 1, ranges);
    else if (event.key === "ArrowLeft") target = nextEnabledIndex(current, -1, ranges);
    else if (event.key === "Home") target = ranges.findIndex((range) => range.enabled);
    else if (event.key === "End") target = ranges.map((r) => r.enabled).lastIndexOf(true);
    if (target === null || target < 0) return;

    event.preventDefault();
    const key = ranges[target]?.key;
    if (key === undefined) return;
    setActiveKey(key);
    tabRefs.current[key]?.focus();
  }

  return (
    <section className="card-surface px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-title font-semibold">خلاصه بازار</h2>

        <div
          role="tablist"
          aria-label="بازه‌ی خلاصه بازار"
          className="flex gap-0.5 rounded-[11px] border border-border bg-surface p-[3px]"
        >
          {ranges.map((range) => (
            <button
              key={range.key}
              ref={(element) => {
                tabRefs.current[range.key] = element;
              }}
              type="button"
              role="tab"
              aria-selected={range.key === activeKey}
              aria-disabled={!range.enabled}
              disabled={!range.enabled}
              tabIndex={range.key === activeKey ? 0 : -1}
              onClick={() => range.enabled && setActiveKey(range.key)}
              onKeyDown={onTabKeyDown}
              data-summary-tab={range.key}
              className={`transition-smooth rounded-[9px] px-3.5 py-1.5 text-meta whitespace-nowrap ${
                !range.enabled
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : range.key === activeKey
                    ? "bg-primary font-medium text-onac"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/*
               * ⚠️ The label of a data-less range does **not** change. An
               * earlier version put "coming soon", but that phrase has a
               * fixed meaning on this page: it's reserved for features that
               * haven't been built yet (price alert). A range
               * that just hasn't accumulated history yet isn't unbuilt —
               * and on a fresh install all three tabs would read "coming
               * soon", making the whole card look unshipped. Disabled state
               * is conveyed by `disabled` and `aria-disabled`, not by text.
               */}
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div
        data-summary-layout
        className="mt-4.5 grid items-center gap-6 sm:grid-cols-[minmax(210px,0.7fr)_minmax(0,2.3fr)] sm:gap-3"
      >
        <div>
          <div
            data-summary-current
            className="num text-display font-semibold tracking-[-0.8px] text-primary"
          >
            {active.currentDisplay === null ? (
              "—"
            ) : (
              <TomanPrice
                value={active.currentDisplay}
                className="inline-flex items-baseline gap-1.5"
                unitClassName="text-[13px] font-normal tracking-normal text-muted-foreground"
              />
            )}
          </div>
          <div className="mt-0.5 text-body">قیمت ۱ گرم طلای ۱۸ عیار</div>
          {/* ⚠️ Naming the owner of the number is mandatory — */}
          <div data-summary-reference className="text-meta text-tx3">
            {summary.referenceName === null ? "—" : `مرجع: ${summary.referenceName}`}
          </div>
        </div>

        {active.area.line === null ? (
          <div
            aria-hidden
            data-summary-chart
            className="h-[108px] w-full rounded-[10px] bg-surface"
          />
        ) : (
          <svg
            aria-hidden
            data-summary-chart
            viewBox="0 0 320 108"
            preserveAspectRatio="none"
            className="block h-[108px] w-full"
          >
            <path d={active.area.area ?? ""} fill="var(--acbg)" />
            <path
              d={active.area.line}
              fill="none"
              stroke="var(--ac)"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/*
       * ⚠️ At 375px three columns of eight-digit numbers overlap, and
       * shrinking the type was not enough — «۱۹٬۸۰۸٬۶۰۰ تومان» still ran
       * into its neighbour. Below `sm` the three stats are rows instead:
       * label on the right, number on the left, one per line. The
       * three-column grid is untouched from `sm` up, and the DOM order
       * stays number-then-label so the desktop stack needs no reordering —
       * `flex-row-reverse` is what puts the label first on a phone.
       */}
      <div className="mt-4.5 grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:gap-2 sm:divide-y-0 sm:pt-3.5">
        <div className="flex min-w-0 flex-row-reverse items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
          <b data-summary-low className="num text-body font-semibold sm:block sm:text-number">
            {active.low === null ? (
              "—"
            ) : (
              <TomanPrice
                value={active.low.valueDisplay}
                className="inline-flex items-baseline gap-1"
                unitClassName="text-[9px] font-normal tracking-normal text-muted-foreground sm:text-[10px]"
              />
            )}
          </b>
          <span className="text-meta whitespace-nowrap text-tx3 sm:block">
            پایین‌ترین
            {active.low === null ? "" : ` · ${active.low.atDisplay}`}
          </span>
        </div>
        <div className="flex min-w-0 flex-row-reverse items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
          <b data-summary-high className="num text-body font-semibold sm:block sm:text-number">
            {active.high === null ? (
              "—"
            ) : (
              <TomanPrice
                value={active.high.valueDisplay}
                className="inline-flex items-baseline gap-1"
                unitClassName="text-[9px] font-normal tracking-normal text-muted-foreground sm:text-[10px]"
              />
            )}
          </b>
          <span className="text-meta whitespace-nowrap text-tx3 sm:block">
            بالاترین
            {active.high === null ? "" : ` · ${active.high.atDisplay}`}
          </span>
        </div>
        <div className="flex min-w-0 flex-row-reverse items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
          <b className="num text-body font-semibold sm:block sm:text-number">
            <ChangeStat range={active} />
          </b>
          <span className="text-meta text-tx3 sm:block">تغییرات</span>
        </div>
      </div>
    </section>
  );
}
