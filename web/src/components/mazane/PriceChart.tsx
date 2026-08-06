/**
 * نمودار ۲۴ ساعته‌ی قیمت مرجع سکوها (تصمیم مالک: خطی، محور مطلق زوم‌شده،
 * هر خط قیمت مرجع یک سکو).
 *
 * سری از `hourly_rollups` می‌آید و در لودر سمت سرور آماده شده. خودِ بوم
 * ریچارتس فقط بعد از hydration کشیده می‌شود (ResponsiveContainer اندازه‌ی
 * واقعی می‌خواهد)، ولی **نوار پایین نمودار سروررندر است** — پس عددهای مرجع
 * در HTML اولیه هستند و خزنده آن‌ها را می‌بیند.
 *
 * سری خالی (پستگرس در دسترس نیست یا هنوز سابقه‌ای نیست) ⟸ پیام کهنگی،
 * هرگز خطا (قاعده‌ی ۵).
 */
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartPlatformView, ChartPoint } from "./home-view";
import { useIsMobile } from "@/hooks/use-mobile";
import { fa, toman } from "@/lib/site-content";

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
  platforms,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  platforms: ChartPlatformView[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  return (
    <div className="min-w-44 rounded-xl border border-border bg-popover/95 p-3 shadow-lift backdrop-blur">
      <div className="mb-2 text-[11px] text-muted-foreground">ساعت {String(label)}</div>
      <div className="space-y-1.5">
        {platforms.map((platform) => {
          const item = payload.find((entry) => entry.dataKey === platform.slug);
          if (item === undefined || typeof item.value !== "number") return null;
          return (
            <div
              key={platform.slug}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <span className="text-foreground">{platform.name}</span>
              </span>
              <span
                className="font-medium tabular-nums"
                style={{ color: platform.color }}
              >
                {fa(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * برچسب انتهای خط — فقط روی آخرین نقطه‌ی همان خط رندر می‌شود.
 *
 * ⚠️ ریچارتس به dot سفارشی `cx`/`cy` می‌دهد، نه `x`/`y` (تجربی تأیید شد:
 * props = key,r,width,height,stroke,strokeWidth,fill,index,cx,cy,value,
 * dataKey,payload,points). طرح اولیه `x`/`y` می‌خواند و به همین دلیل هیچ‌وقت
 * برچسبی رسم نمی‌شد.
 */
function makeEndLabel(
  platform: ChartPlatformView,
  lastIndex: number,
  dim: boolean,
) {
  return function EndLabel(props: { cx?: number; cy?: number; index?: number }) {
    if (props.index !== lastIndex || props.cx == null || props.cy == null) {
      return <g />;
    }
    return (
      <g transform={`translate(${props.cx + 8}, ${props.cy})`} opacity={dim ? 0.5 : 1}>
        <text
          x={0}
          y={-3}
          fontSize={11}
          fontWeight={600}
          fill={platform.color}
          textAnchor="start"
        >
          {platform.name}
        </text>
        {platform.latestToman !== null && (
          <text
            x={0}
            y={11}
            fontSize={10}
            fill="var(--color-muted-foreground)"
            textAnchor="start"
          >
            {fa(platform.latestToman)}
          </text>
        )}
      </g>
    );
  };
}

export function PriceChart({
  platforms,
  series,
  domain,
}: {
  platforms: ChartPlatformView[];
  series: ChartPoint[];
  domain: [number, number] | null;
}) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => setMounted(true), []);

  /** فقط سکوهایی خط می‌گیرند که در این بازه واقعاً نقطه دارند. */
  const drawn = useMemo(
    () => platforms.filter((platform) => platform.hasSeries),
    [platforms],
  );

  /** نوار پایین: پرقیمت به کم‌قیمت؛ سکوی بی‌داده آخر و محو. */
  const legend = useMemo(
    () =>
      [...platforms].sort(
        (a, b) => (b.latestToman ?? -Infinity) - (a.latestToman ?? -Infinity),
      ),
    [platforms],
  );

  /**
   * شاخص آخرین نقطه‌ی **هر سکو** (نه آخرین ستون سری): سکویی که چند ساعت
   * آخر داده ندارد هم باید برچسب انتهای خط خودش را بگیرد.
   */
  const lastIndexBySlug = useMemo(() => {
    const result = new Map<string, number>();
    for (const platform of platforms) {
      let last = -1;
      for (let i = series.length - 1; i >= 0; i--) {
        if (typeof series[i]?.[platform.slug] === "number") {
          last = i;
          break;
        }
      }
      result.set(platform.slug, last);
    }
    return result;
  }, [platforms, series]);

  const hasSeries = series.length > 0 && drawn.length > 0 && domain !== null;

  return (
    <section className="glass-surface rise-in overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            مظنه‌ی مرجع هر گرم طلای ۱۸ عیار
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            روند ۲۴ ساعت گذشته در سکوهای منتخب
          </p>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-muted-foreground">
          به‌روزرسانی هر ۳۰ ثانیه
        </span>
      </div>

      <div className="px-1 pt-4 sm:px-3">
        <div dir="ltr" className="h-[260px] w-full sm:h-[380px]">
          {!hasSeries ? (
            <div className="grid h-full w-full place-items-center rounded-xl bg-surface px-6 text-center">
              <p className="text-xs leading-6 text-muted-foreground">
                هنوز سابقه‌ی ۲۴ ساعته‌ای برای رسم نمودار ثبت نشده است. قیمت‌های
                جاری در جدول پایین در دسترس‌اند.
              </p>
            </div>
          ) : mounted ? (
            <ResponsiveContainer width="100%" height="100%" debounce={80}>
              <LineChart
                data={series}
                margin={{ top: 10, right: isMobile ? 10 : 108, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={48}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  domain={domain}
                  width={isMobile ? 46 : 58}
                  tickLine={false}
                  axisLine={false}
                  tickCount={6}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(value: number) => fa(Math.round(value / 1000))}
                />
                <Tooltip
                  content={<ChartTooltip platforms={drawn} />}
                  cursor={{
                    stroke: "var(--color-ring)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                {drawn.map((platform) => {
                  const dim = platform.state === "coming-soon";
                  return (
                    <Line
                      key={platform.slug}
                      type="monotone"
                      dataKey={platform.slug}
                      stroke={platform.color}
                      strokeWidth={dim ? 1.5 : 2.2}
                      strokeOpacity={dim ? 0.28 : 1}
                      connectNulls
                      dot={
                        isMobile
                          ? false
                          : makeEndLabel(
                              platform,
                              lastIndexBySlug.get(platform.slug) ?? -1,
                              dim,
                            )
                      }
                      activeDot={{
                        r: 3.5,
                        strokeWidth: 2,
                        stroke: "var(--color-background)",
                      }}
                      isAnimationActive
                      animationDuration={900}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-xl bg-surface" />
          )}
        </div>

        {hasSeries && (
          <p className="px-4 pb-1 text-[11px] text-muted-foreground sm:px-6">
            محور عمودی بر حسب هزار تومان
          </p>
        )}
      </div>

      {/* سروررندر — قیمت‌های مرجع همین‌جا در HTML اولیه‌اند. */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 px-4 py-3 sm:px-6">
        {legend.map((platform) => (
          <div
            key={platform.slug}
            className="flex items-center gap-2 text-xs"
            style={{ opacity: platform.state === "coming-soon" ? 0.45 : 1 }}
          >
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: platform.color }}
            />
            <span className="font-medium" style={{ color: platform.color }}>
              {platform.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {platform.latestToman === null
                ? "به‌زودی"
                : toman(platform.latestToman)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
