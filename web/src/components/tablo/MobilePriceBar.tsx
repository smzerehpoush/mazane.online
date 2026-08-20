/**
 * ⚠️ **Never rendered conditionally, and never above `min-[1081px]`.** The
 * bar is in the server HTML on every viewport and is taken out of view —
 * and out of the accessibility tree and the tab order — with `invisible`,
 * so hydration sees one DOM. Rendering it only after mount would move the
 * page under the reader's thumb on the very first scroll.
 * ⚠️ The number here is `reference.priceToman`, the same field the desktop
 * strip reads and the same value the market summary prints. It is **not**
 * patched by `DashboardLive` — nothing on this page patches the reference
 * number — so the bar cannot drift away from the card it echoes.
 */
import { useEffect, useState } from "react";

import { formatToman } from "@/lib/format";
import { homePriceBar } from "@/lib/site-content";
import { TomanPrice } from "./TomanPrice";

export const PRICE_BAR_ANCHOR_ATTRIBUTE = "data-home-price-bar-anchor";

export function PriceBarAnchor() {
  return <div {...{ [PRICE_BAR_ANCHOR_ATTRIBUTE]: true }} aria-hidden className="h-px w-full" />;
}

export function MobilePriceBar({
  priceToman,
  referenceName,
}: {
  priceToman: number | null;
  referenceName: string;
}) {
  const [passed, setPassed] = useState(false);

  /**
   * ⚠️ The bar waits for the buy-path section to leave the viewport, not for
   * the price card. Showing it earlier would put two «از کجا بخرم؟» calls to
   * action in one screen — the duplication `homeActions` drops `kodam-saku`
   * to avoid.
   * ⚠️ **Not an `IntersectionObserver`, and this is not a preference.** The
   * observer reports *changes of state* computed at frame boundaries, and a
   * one-pixel sentinel can go from below the viewport to above it inside a
   * single frame — a fling on a phone does exactly that. The status never
   * becomes "intersecting", so no callback is ever delivered and the bar
   * never appears. Reading the position on a passive, rAF-coalesced
   * listener answers the only question being asked ("is it above me now?")
   * and cannot be skipped.
   */
  useEffect(() => {
    const anchor = document.querySelector(`[${PRICE_BAR_ANCHOR_ATTRIBUTE}]`);
    if (anchor === null) return;

    let frame = 0;
    function measure(): void {
      frame = 0;
      if (anchor === null) return;
      setPassed(anchor.getBoundingClientRect().top < 0);
    }
    function schedule(): void {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      data-home-price-bar
      data-shown={passed ? "true" : "false"}
      aria-label={homePriceBar.ariaLabel}
      className={`safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 backdrop-blur-xl transition-transform duration-200 ease-out motion-reduce:transition-none min-[1081px]:hidden ${
        passed ? "translate-y-0" : "invisible translate-y-full"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1340px] items-center justify-between gap-3 px-4 py-2">
        <a
          href={homePriceBar.priceHref}
          data-home-price-bar-price
          className="flex min-h-11 min-w-0 flex-col justify-center"
        >
          <span className="truncate text-meta text-muted-foreground">
            {homePriceBar.label} · {referenceName}
          </span>
          {priceToman === null ? (
            <span className="text-meta text-muted-foreground">{homePriceBar.unavailable}</span>
          ) : (
            <TomanPrice
              value={formatToman(priceToman)}
              className="num inline-flex items-baseline gap-1 text-number font-semibold tracking-[-0.3px] text-foreground"
              unitClassName="text-[10px] font-normal tracking-normal text-muted-foreground"
            />
          )}
        </a>
        <a
          href={homePriceBar.ctaHref}
          data-home-price-bar-cta
          className="transition-smooth inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-body font-medium text-primary-foreground hover:bg-primary/90"
        >
          {homePriceBar.cta}
        </a>
      </div>
    </div>
  );
}
