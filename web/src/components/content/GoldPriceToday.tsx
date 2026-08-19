import { Fragment, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { RangeTabs, type RangeEnabledMap } from "@/components/content/RangeTabs";
import { Staleness } from "@/components/content/RowParts";
import type { SummaryRange } from "@/lib/dashboard";
import type { HistoryRange } from "@/lib/history";
import {
  GOLD_PRICE_FAQ,
  GOLD_PRICE_FAQ_HEADING,
  GOLD_PRICE_LABELS,
  GOLD_PRICE_SECTIONS,
  type GoldPriceView,
} from "@/lib/gold-price";

function enabledMapOf(ranges: readonly SummaryRange[]): RangeEnabledMap {
  const map = { DAILY: false, WEEKLY: false, MONTHLY: false } as Record<HistoryRange, boolean>;
  for (const range of ranges) map[range.key] = range.enabled;
  return map;
}

function Direction({ fraction }: { fraction: number | null }) {
  if (fraction === null || fraction === 0) return null;
  return fraction > 0 ? (
    <TrendingUp aria-hidden className="size-3.5" />
  ) : (
    <TrendingDown aria-hidden className="size-3.5" />
  );
}

function toneOf(fraction: number | null): string {
  if (fraction === null || fraction === 0) return "text-muted-foreground";
  return fraction > 0 ? "text-positive" : "text-negative";
}

function DeltaCell({ range }: { range: SummaryRange }) {
  const tone = toneOf(range.changeFraction);
  return (
    <div
      data-gold-delta={range.key}
      className="rounded-[18px] border border-border bg-surface px-4 py-3"
    >
      <p className="text-[11px] text-muted-foreground">{range.label}</p>
      {range.enabled && range.changeTomanDisplay !== null ? (
        <>
          <p
            className={`num mt-1.5 inline-flex items-center gap-1 text-[15px] font-semibold ${tone}`}
          >
            <Direction fraction={range.changeFraction} />
            <span>
              {range.changeTomanDisplay}
              <span className="ms-1 text-[10px] font-normal text-muted-foreground">تومان</span>
            </span>
          </p>
          <p data-gold-delta-percent className={`num text-[12px] ${tone}`}>
            {range.changeDisplay}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          {GOLD_PRICE_LABELS.changeMissing}
        </p>
      )}
    </div>
  );
}

function Chart({ range }: { range: SummaryRange }) {
  if (range.area.line === null) {
    return (
      <p data-gold-chart-empty className="text-xs leading-6 text-muted-foreground">
        {GOLD_PRICE_LABELS.emptyChart}
      </p>
    );
  }
  return (
    <div dir="ltr" className="w-full">
      <svg
        aria-hidden
        data-gold-chart
        viewBox="0 0 320 108"
        preserveAspectRatio="none"
        className="block h-[108px] w-full"
      >
        <defs>
          <linearGradient id="gold-price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={range.area.area ?? ""} fill="url(#gold-price-fill)" />
        <path
          d={range.area.line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function GoldPriceCard({ view, nowMs }: { view: GoldPriceView; nowMs: number }) {
  const enabled = enabledMapOf(view.ranges);
  const [activeRange, setActiveRange] = useState<HistoryRange>(
    () => view.ranges.find((range) => range.enabled)?.key ?? "DAILY",
  );
  const active = view.ranges.find((range) => range.key === activeRange) ?? view.ranges[0];

  return (
    <section aria-labelledby="gold-price-heading" className="card-surface px-5 py-5 sm:px-6">
      <h2 id="gold-price-heading" className="sr-only">
        {GOLD_PRICE_LABELS.chartHeading}
      </h2>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div data-gold-price className="num text-[32px] leading-[1.2] font-bold text-primary">
            {view.priceDisplay === null ? (
              <span className="text-[20px] font-semibold text-muted-foreground">
                {GOLD_PRICE_LABELS.unavailable}
              </span>
            ) : (
              <>
                {view.priceDisplay}
                <span className="ms-2 text-[13px] font-normal text-muted-foreground">تومان</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[13px]">{GOLD_PRICE_LABELS.priceCaption}</p>
          <p data-gold-reference className="text-[12px] text-muted-foreground">
            {`${GOLD_PRICE_LABELS.referencePrefix} ${view.referenceName}`}
          </p>
          <div className="mt-1">
            {view.priceDisplay === null ? (
              <p className="text-[11px] leading-6 text-muted-foreground">
                {GOLD_PRICE_LABELS.unavailableNote}
              </p>
            ) : (
              <Staleness updatedAt={view.readAt} nowMs={nowMs} />
            )}
          </div>
          {view.fromArchive ? (
            <p data-gold-archive className="mt-1 text-[11px] text-muted-foreground">
              {GOLD_PRICE_LABELS.archiveNote}
            </p>
          ) : null}
        </div>

        <RangeTabs
          active={activeRange}
          enabled={enabled}
          onSelect={setActiveRange}
          ariaLabel={GOLD_PRICE_LABELS.chartRangeLabel}
        />
      </div>

      {active === undefined ? null : (
        <>
          <div className="mt-4">
            <Chart range={active} />
          </div>

          {active.high !== null && active.low !== null ? (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/70 pt-3 text-[12px] text-muted-foreground">
              <span className="num" data-gold-high>
                {GOLD_PRICE_LABELS.high}: {active.high.valueDisplay} تومان
              </span>
              <span className="num" data-gold-low>
                {GOLD_PRICE_LABELS.low}: {active.low.valueDisplay} تومان
              </span>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5 border-t border-border/70 pt-4">
        <h2 className="text-base font-semibold">{GOLD_PRICE_LABELS.changeHeading}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {view.ranges.map((range) => (
            <DeltaCell key={range.key} range={range} />
          ))}
        </div>
        <p data-gold-yearly className="mt-3 text-[12px] leading-7 text-muted-foreground">
          <strong className="font-medium text-foreground/80">
            {GOLD_PRICE_LABELS.yearlyHeading}:
          </strong>{" "}
          {GOLD_PRICE_LABELS.yearlyBody}
        </p>
      </div>
    </section>
  );
}

export function GoldPriceBody() {
  return (
    <>
      {GOLD_PRICE_SECTIONS.map((section) => (
        <section key={section.id} data-gold-section={section.id} className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <Fragment key={paragraph}>
              <p className="mt-3 text-[14px] leading-8 text-foreground/80">{paragraph}</p>
              {section.formula !== undefined && index === 0 ? (
                <p
                  data-gold-formula
                  className="num mt-3 rounded-[16px] border border-border bg-surface px-4 py-3 text-[13px] leading-8 text-foreground/85"
                >
                  {section.formula}
                </p>
              ) : null}
            </Fragment>
          ))}
          {section.link === undefined ? null : (
            <p className="mt-3 text-[13px]">
              <a
                href={section.link.href}
                className="transition-smooth text-primary hover:underline"
              >
                {section.link.label}
              </a>
            </p>
          )}
        </section>
      ))}

      <section data-gold-section="gold-price-faq" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">{GOLD_PRICE_FAQ_HEADING}</h2>
        <div className="mt-4 space-y-3">
          {GOLD_PRICE_FAQ.map((item) => (
            <section
              key={item.question}
              className="rounded-[18px] border border-border bg-surface p-4"
            >
              <h3 className="font-semibold text-foreground">{item.question}</h3>
              <p className="mt-2 text-[13px] leading-7 text-foreground/80">{item.answer}</p>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
