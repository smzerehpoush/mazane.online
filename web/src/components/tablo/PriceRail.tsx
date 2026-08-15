/**
 * ⚠️ **Works without JavaScript too**: each marker's position is
 * server-rendered in the same `style` attribute, and prices are plain
 * text. Animation, the fuse, and polling are an extra layer that's simply
 * absent with JS off — not that the page goes blank.
 */
import { useEffect, useRef } from "react";

import type { RailView } from "@/lib/dashboard";

const STEM_LONG_PX = 38;
const STEM_SHORT_PX = 10;

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

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15.5px] font-semibold">محور قیمت طلای ۱۸ عیار</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            هرچه راست‌تر، ارزان‌تر · خط طلایی که تمام شود، قیمت‌ها تازه می‌شوند
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
           * 96%) has half its label falling outside the box. Measured at
           * 375px: Talasea reached 378px and Wallgold reached −3px.
           * padding doesn't work — an absolute element's percentage
           * resolves against the **padding box**, so padding doesn't pull
           * it in; margin does. The extra height on mobile is intentional
           * (≤620px).
           */}
          <div data-rail className="relative mx-7 mt-3 h-[180px] sm:mx-0 sm:h-[132px]">
            <div className="absolute top-[30px] right-[4%] left-[4%] h-px bg-line2">
              <div
                ref={fuseRef}
                data-rail-fuse
                aria-hidden
                className="rail-fuse absolute top-[-1px] right-0 h-[3px] rounded-[2px] bg-gold"
              />
            </div>

            {rail.referencePercent !== null && (
              <>
                <div
                  aria-hidden
                  data-rail-anchor
                  className="rail-anchor absolute top-2 bottom-1.5 w-0 border-r border-dashed border-primary opacity-45"
                  style={{ right: `${rail.referencePercent}%` }}
                />
                <span
                  data-rail-anchor-label
                  className="rail-anchor absolute top-0 translate-x-1/2 rounded-[20px] bg-acbg px-2 py-0.5 text-[10.5px] whitespace-nowrap text-actx"
                  style={{ right: `${rail.referencePercent}%` }}
                >
                  قیمت مرجع
                </span>
              </>
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
                  aria-label={source.ariaLabel}
                  className="rail-marker absolute top-6 flex translate-x-1/2 flex-col items-center text-inherit no-underline"
                  style={{ right: `${source.railPercent}%` }}
                >
                  <span
                    className="size-[13px] rounded-full border-[2.5px] bg-card transition-transform duration-200 group-hover:scale-125"
                    style={{ borderColor: source.color }}
                  />
                  <span
                    data-rail-stem
                    className="w-px bg-line2"
                    style={{ height: `${source.stemLong ? STEM_LONG_PX : STEM_SHORT_PX}px` }}
                  />
                  <span className="mt-[5px] text-xs whitespace-nowrap">{source.name}</span>
                  <span data-rail-price className="num text-[11.5px] whitespace-nowrap text-tx3">
                    {source.priceDisplay}
                  </span>
                </a>
              ),
            )}
          </div>

          {/*
           * ⚠️ DOM order matters here: in RTL, the **first** child of
           * `justify-between` sits on the right. "Cheaper" must come on
           * the right to agree with where the markers are. Swapping these
           * two would make the footnote contradict the rail itself.
           */}
          <div className="mx-5 flex items-center justify-between border-t border-border pt-3 pb-4 text-[11.5px] text-tx3 sm:mx-6">
            <span data-rail-min>{rail.minDisplay} · ارزان‌تر</span>
            <span data-rail-spread className="text-muted-foreground">
              بازه اختلاف {rail.spreadDisplay} تومان
            </span>
            <span data-rail-max>گران‌تر · {rail.maxDisplay}</span>
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
