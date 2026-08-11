/**
 * خلاصه بازار (بند ۷ سند طراحی).
 *
 * ⚠️ **این کارت میانگین نیست.** طرح اولیه «میانگین پنج منبع» می‌خواست؛
 * میانگین بین‌سکویی خط قرمز حقوقی است (`CONTEXT.md`، بند ۷.۱ سند معماری) و
 * هرگز محاسبه یا منتشر نمی‌شود. هر چهار عدد و خودِ سری **مال سکوی مرجع**اند و
 * برچسب زیر عدد درشت نامش را صریح می‌برد — بند ۱۵، تصمیم ۳.
 *
 * ⚠️ داده‌ی **هر سه بازه** از سرور آمده (`assembleHomeData`)، پس تعویض زبانه
 * هیچ فچی نمی‌زند و فقط بین سه شیء آماده جابه‌جا می‌شود. حجمش ناچیز است:
 * بلندترین بازه (ماهانه) ۹۳ نقطه دارد و هر سه با هم به چند کیلوبایت
 * نمی‌رسند — سنجیده شد پیش از اینکه این تصمیم گرفته شود.
 *
 * زبانه‌ها با `role="tablist"` و پیمایش کیبورد (جهت‌نماها، Home/End) — بند ۱۲.
 * نمودار `aria-hidden` است چون همان اطلاعات در سه آمار زیرش متنی موجود است.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { SummaryRange, SummaryView } from "@/lib/dashboard";
import type { HistoryRange } from "@/lib/history";

/** اولین زبانه‌ی فعال در جهت داده‌شده، با چرخش — زبانه‌های بی‌داده رد می‌شوند. */
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
        <h2 className="text-[15.5px] font-semibold">خلاصه بازار</h2>

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
              className={`transition-smooth rounded-[9px] px-3.5 py-1.5 text-[12.5px] whitespace-nowrap ${
                !range.enabled
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : range.key === activeKey
                    ? "bg-primary font-medium text-onac"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.enabled ? range.label : "به‌زودی"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4.5 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <div
            data-summary-current
            className="num text-[31px] leading-[1.25] font-semibold tracking-[-0.8px] text-primary"
          >
            {active.currentDisplay ?? "—"}
          </div>
          <div className="mt-0.5 text-[15px]">قیمت ۱ گرم طلای ۱۸ عیار</div>
          {/* ⚠️ نام صاحب عدد اجباری است — قاعده‌ی سخت ۴. */}
          <div className="text-[12.5px] text-tx3">
            قیمت مرجع · {summary.referenceName ?? "—"} · تومان
          </div>
        </div>

        {active.area.line === null ? (
          <div aria-hidden className="h-[108px] w-full rounded-[10px] bg-surface" />
        ) : (
          <svg
            aria-hidden
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

      {/* ⚠️ در ۳۷۵px سه ستون با اعداد هشت‌رقمی روی هم می‌افتادند. اندازه‌ی
          کوچک‌تر و `gap` روی موبایل مشکل را حل می‌کند بدون اینکه چیدمان
          سه‌ستونه‌ی بند ۷ عوض شود — ساعتِ وقوع هم زیر عدد می‌رود، نه کنارش. */}
      <div className="mt-4.5 grid grid-cols-3 gap-2 border-t border-border pt-3.5">
        <div className="min-w-0">
          <b data-summary-low className="num block text-[13px] font-semibold sm:text-[15.5px]">
            {active.low?.valueDisplay ?? "—"}
          </b>
          <span className="block text-[11px] text-tx3 sm:text-xs">
            پایین‌ترین
            {active.low === null ? "" : ` · ${active.low.atDisplay}`}
          </span>
        </div>
        <div className="min-w-0">
          <b data-summary-high className="num block text-[13px] font-semibold sm:text-[15.5px]">
            {active.high?.valueDisplay ?? "—"}
          </b>
          <span className="block text-[11px] text-tx3 sm:text-xs">
            بالاترین
            {active.high === null ? "" : ` · ${active.high.atDisplay}`}
          </span>
        </div>
        <div className="min-w-0">
          <b className="num block text-[13px] font-semibold sm:text-[15.5px]">
            <ChangeStat range={active} />
          </b>
          <span className="block text-[11px] text-tx3 sm:text-xs">تغییرات</span>
        </div>
      </div>
    </section>
  );
}
