import { useRef, type KeyboardEvent } from "react";

import type { HistoryRange } from "@/lib/history";
import { RATE_CARD_RANGES, type RateCardRangeConfig } from "@/lib/site-content";

export type RangeEnabledMap = Readonly<Record<HistoryRange, boolean>>;

function nextEnabledIndex(start: number, direction: 1 | -1, enabled: readonly boolean[]): number {
  const n = enabled.length;
  for (let step = 1; step <= n; step++) {
    const index = (start + direction * step + n * n) % n;
    if (enabled[index] === true) return index;
  }
  return start;
}

function RangeTab({
  range,
  label,
  active,
  enabled,
  onSelect,
  onKeyDown,
  tabRef,
}: {
  range: RateCardRangeConfig;
  label: string;
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
      data-range-tab={range.key}
      className={`transition-smooth rounded-full px-3 py-1.5 text-xs font-medium ${
        !enabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function RangeTabs({
  active,
  enabled,
  onSelect,
  ariaLabel,
  disabledLabel,
}: {
  active: HistoryRange;
  enabled: RangeEnabledMap;
  onSelect: (range: HistoryRange) => void;
  ariaLabel: string;
  disabledLabel?: string;
}) {
  const tabRefs = useRef<Partial<Record<HistoryRange, HTMLButtonElement | null>>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const order = RATE_CARD_RANGES.map((range) => range.key);
    const flags = order.map((key) => enabled[key] === true);
    const currentIndex = order.indexOf(active);

    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") targetIndex = nextEnabledIndex(currentIndex, 1, flags);
    else if (event.key === "ArrowLeft") targetIndex = nextEnabledIndex(currentIndex, -1, flags);
    else if (event.key === "Home") targetIndex = flags.indexOf(true);
    else if (event.key === "End") targetIndex = flags.lastIndexOf(true);
    if (targetIndex === null || targetIndex < 0) return;

    event.preventDefault();
    const targetRange = order[targetIndex] as HistoryRange;
    onSelect(targetRange);
    tabRefs.current[targetRange]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center gap-1 rounded-full bg-surface p-1"
    >
      {RATE_CARD_RANGES.map((range) => {
        const isEnabled = enabled[range.key] === true;
        return (
          <RangeTab
            key={range.key}
            range={range}
            label={isEnabled || disabledLabel === undefined ? range.label : disabledLabel}
            active={active === range.key}
            enabled={isEnabled}
            onSelect={() => {
              if (isEnabled) onSelect(range.key);
            }}
            onKeyDown={handleKeyDown}
            tabRef={(el) => {
              tabRefs.current[range.key] = el;
            }}
          />
        );
      })}
    </div>
  );
}
