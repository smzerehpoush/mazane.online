/**
 * ⚠️ **Works without JavaScript too**: each marker's position is
 * server-rendered in the same `style` attribute, and prices are plain
 * text. Animation, the fuse, and polling are an extra layer that's simply
 * absent with JS off — not that the page goes blank.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";

import type { RailView } from "@/lib/dashboard";
import { formatFaNumber } from "@/lib/fa-number";
import { TomanPrice } from "./TomanPrice";

const RAIL_TIMER_SECONDS = 30;
const RAIL_TIMER_MS = RAIL_TIMER_SECONDS * 1000;
const STEM_LONG_PX = 38;
const STEM_SHORT_PX = 10;

export function railCountdownSeconds(updatedAt: string | null, nowMs: number): number {
  if (updatedAt === null) return RAIL_TIMER_SECONDS;
  const updatedAtMs = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return RAIL_TIMER_SECONDS;
  const elapsedMs = nowMs - updatedAtMs;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return RAIL_TIMER_SECONDS;
  const remainingMs = RAIL_TIMER_MS - (elapsedMs % RAIL_TIMER_MS);
  return Math.max(1, Math.min(RAIL_TIMER_SECONDS, Math.ceil(remainingMs / 1000)));
}

export function PriceRail({
  rail,
  updatedAt,
  updatedAtDisplay,
  tick,
  failed,
}: {
  rail: RailView;
  updatedAt: string | null;
  updatedAtDisplay: string | null;
  tick: number;
  failed: boolean;
}) {
  const fuseRef = useRef<HTMLDivElement | null>(null);
  const [countdown, setCountdown] = useState(RAIL_TIMER_SECONDS);
  const [activeMarkerSlug, setActiveMarkerSlug] = useState<string | null>(null);

  /** ⚠️ Only after mount: `Date.now` is forbidden in server rendering. */
  useEffect(() => {
    const fuse = fuseRef.current;
    if (fuse === null) return;

    if (updatedAt === null) {
      fuse.style.animation = "none";
      return;
    }

    /**
     * ⚠️ On a fetch failure the fuse must **stop**. This isn't decoration —
     * a burning fuse is a promise: "when it runs out, prices refresh" (the
     * same text under the card's title). When the connection is down, that
     * promise becomes a lie and is worse than not showing it at all: the
     * user takes a stale number for a fresh one. The error banner alone
     * isn't enough, because the fuse would still fill and empty every 30
     * seconds, and motion reads stronger than static text.
     */
    if (failed) {
      fuse.style.animationPlayState = "paused";
      return;
    }

    const elapsedSeconds = (Date.now() - new Date(updatedAt).getTime()) / 1000;
    const remaining = Math.max(0, 30 - (elapsedSeconds % 30));

    fuse.style.animation = "none";
    void fuse.offsetWidth;
    fuse.style.animation = "";
    fuse.style.animationDelay = `-${30 - remaining}s`;
    fuse.style.animationPlayState = "running";
  }, [updatedAt, tick, failed]);

  useEffect(() => {
    if (updatedAt === null || failed) return;

    function syncCountdown(): void {
      setCountdown(railCountdownSeconds(updatedAt, Date.now()));
    }

    syncCountdown();
    const id = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(id);
  }, [updatedAt, tick, failed]);

  function handleMarkerClick(event: MouseEvent<HTMLAnchorElement>, slug: string): void {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    if (activeMarkerSlug === slug) return;
    event.preventDefault();
    setActiveMarkerSlug(slug);
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15.5px] font-semibold">محور قیمت طلای ۱۸ عیار</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            هرچه راست‌تر، گران‌تر · خط طلایی که تمام شود، قیمت‌ها تازه می‌شوند
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {updatedAt !== null && (
            <span className="text-[10.5px] text-tx3">
              آخرین به‌روزرسانی{" "}
              <time dateTime={updatedAt} data-rail-updated className="num">
                {updatedAtDisplay}
              </time>
            </span>
          )}
        </div>
      </div>

      {failed && (
        <p
          data-rail-error
          role="status"
          className="mx-5 mb-1 rounded-[10px] bg-ambg px-3 py-2 text-[11.5px] text-am sm:mx-6"
        >
          اتصال برقرار نیست — تلاش مجدد
        </p>
      )}

      {rail.hasRail ? (
        <>
          {/*
           * ⚠️ `mx` on mobile is required, not decorative: the marker is
           * centered with `translateX(50%)`, so an edge marker (4% and
           * 96%) can open a tooltip beyond the box. Padding doesn't work
           * here — an absolute element's percentage
           * resolves against the **padding box**, so padding doesn't pull
           * it in; margin does. The extra height on mobile is intentional
           * (≤620px).
           */}
          <div data-rail className="relative mx-7 mt-3 h-[164px] sm:mx-0 sm:h-[140px]">
            <div className="absolute top-[30px] right-[4%] left-[4%] h-px bg-line2">
              <div
                ref={fuseRef}
                data-rail-fuse
                data-rail-countdown={formatFaNumber(countdown)}
                aria-hidden
                className="rail-fuse absolute top-[-1px] right-0 h-[3px] rounded-[2px] bg-gold"
              />
            </div>

            {rail.referencePercent !== null && (
              <div
                aria-hidden
                data-rail-anchor
                className="rail-anchor absolute top-2 bottom-1.5 w-0 border-r border-dashed border-primary opacity-45"
                style={{ right: `${rail.referencePercent}%` }}
              />
            )}

            {rail.sources.map((source) =>
              source.railPercent === null ? null : (
                <a
                  /** ⚠️ Key = slug. Anything else means re-mount and the death of the transition. */
                  key={source.slug}
                  href={source.href}
                  rel="sponsored nofollow noopener"
                  target="_blank"
                  data-outbound="price-rail"
                  data-rail-marker={source.slug}
                  data-rail-name={source.name}
                  data-active={activeMarkerSlug === source.slug ? "true" : undefined}
                  aria-label={source.ariaLabel}
                  className="rail-marker group absolute top-6 flex translate-x-1/2 flex-col items-center text-inherit no-underline focus-visible:outline-none"
                  style={{ right: `${source.railPercent}%` }}
                  onClick={(event) => handleMarkerClick(event, source.slug)}
                  onFocus={() => setActiveMarkerSlug(source.slug)}
                  onBlur={() => setActiveMarkerSlug(null)}
                  onMouseEnter={() => setActiveMarkerSlug(source.slug)}
                  onMouseLeave={() => setActiveMarkerSlug(null)}
                >
                  <span
                    className="size-[13px] rounded-full border-[2.5px] bg-card transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125"
                    style={{ borderColor: source.color }}
                  />
                  <span
                    data-rail-stem
                    className="w-px bg-line2"
                    style={{ height: `${source.stemLong ? STEM_LONG_PX : STEM_SHORT_PX}px` }}
                  />
                  <span
                    data-rail-label
                    data-rail-label-position={source.stemLong ? "below" : "above"}
                    className={[
                      "max-w-[74px] truncate rounded-full bg-card/85 px-1.5 text-[11px] whitespace-nowrap shadow-[0_0_0_1px_var(--color-border)] sm:max-w-[92px] sm:text-xs",
                      source.stemLong
                        ? "mt-[5px]"
                        : "absolute top-[-27px] left-1/2 -translate-x-1/2",
                    ].join(" ")}
                  >
                    {source.name}
                  </span>
                  <span
                    data-rail-tooltip
                    role="tooltip"
                    className="rail-tooltip absolute top-[calc(100%+7px)] left-1/2 z-20 min-w-[118px] -translate-x-1/2 rounded-2xl border border-border bg-card/95 px-3 py-2 text-center shadow-card backdrop-blur-md"
                  >
                    <span
                      data-rail-price
                      className="num block text-[11.5px] whitespace-nowrap text-tx3"
                    >
                      {source.priceDisplay !== null && (
                        <TomanPrice
                          value={source.priceDisplay}
                          className="inline-flex items-baseline gap-1"
                          unitClassName="text-[9px] font-normal tracking-normal text-muted-foreground"
                        />
                      )}
                    </span>
                  </span>
                </a>
              ),
            )}
          </div>

          {/*
           * ⚠️ DOM order matters here: in RTL, the **first** child of
           * `justify-between` sits on the right. "Pricier" must come on
           * the right to agree with where the markers are. Swapping these
           * two would make the footnote contradict the rail itself.
          */}
          <div className="mx-5 flex items-center justify-between border-t border-border pt-3 pb-4 text-[11.5px] text-tx3 sm:mx-6">
            <span data-rail-max className="inline-flex items-baseline gap-1.5">
              بیشترین قیمت ·{" "}
              {rail.maxDisplay !== null && (
                <TomanPrice
                  value={rail.maxDisplay}
                  className="num inline-flex items-baseline gap-1"
                  unitClassName="text-[9px] font-normal tracking-normal text-muted-foreground"
                />
              )}
            </span>
            <span data-rail-spread className="hidden">
              بازه اختلاف {rail.spreadDisplay} تومان
            </span>
            <span data-rail-min className="inline-flex items-baseline gap-1.5">
              کمترین قیمت ·{" "}
              {rail.minDisplay !== null && (
                <TomanPrice
                  value={rail.minDisplay}
                  className="num inline-flex items-baseline gap-1"
                  unitClassName="text-[9px] font-normal tracking-normal text-muted-foreground"
                />
              )}
            </span>
          </div>
        </>
      ) : (
        <p className="px-5 pb-5 text-xs leading-6 text-muted-foreground sm:px-6">
          برای رسم محور دست‌کم دو سکوی قیمت‌دار لازم است. قیمت‌های موجود در کارت‌های پایین در
          دسترس‌اند.
        </p>
      )}
    </section>
  );
}
