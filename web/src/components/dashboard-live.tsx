/**
 * ⚠️ **Why direct DOM and not React state**: the rail marker has to slide
 * with an 800ms transition. If the position came from state, every update
 * would be a fresh tree render, and the smallest change to `key` or ordering
 * would re-mount the node and kill the transition — exactly the kind of
 * breakage where "the code looks fine".
 * ⚠️ **Does that mean no re-render happens? No.** `useLiveDashboard` works
 * with `useState`, so every successful fetch re-renders the whole page tree.
 * What keeps the writes below intact is that `rail.sources` is built from
 * the loader data and **never changes**; so React's diff sees no change to
 * `style.right` and leaves the node alone. This is a fragile contract and
 * must stay explicit: if the marker position ever comes from props, React
 * will reset it to the server value on every render and the markers will
 * jump.
 * ⚠️ **No computation or formatting happens here**:
 * `rail_percent` and `price_display` are already built server-side
 * (`lib/dashboard.ts`, the same function that produced the initial render).
 * This component only places them.
 * ⚠️ **Update flash**: the color direction comes from that same source's
 * price change relative to its own previous value — not a comparison with
 * another source. No number is published, so this doesn't conflict with
 * (the removal of the percent-diff badge).
 */
import { useEffect, useRef } from "react";

import type { BubbleRiskLevel } from "@/lib/bubble";
import { nextRowDomState, type LiveDashboard } from "@/lib/live-update";
import { BUBBLE_INPUT_MISSING_FA, COIN_PRICE_UNCOLLECTED_FA } from "@/lib/undisclosed";

const FLASH_MS = 900;

function setPriceText(root: ParentNode, selector: string, value: string | null): void {
  if (value === null) return;
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) return;
  const valueElement = element.querySelector<HTMLElement>("[data-price-value]");
  if (valueElement !== null) {
    if (valueElement.textContent !== value) valueElement.textContent = value;
    return;
  }
  if (element.textContent !== value) element.textContent = value;
}

function setTomanText(
  root: ParentNode,
  selector: string,
  value: string | null,
  fallback = "—",
): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) return;
  const valueElement = element.querySelector<HTMLElement>("[data-price-value]");
  if (valueElement === null) {
    element.textContent = value ?? fallback;
    return;
  }
  const nextValue = value ?? fallback;
  if (valueElement.textContent !== nextValue) valueElement.textContent = nextValue;
  const unitElement = element.querySelector<HTMLElement>("[data-price-unit]");
  if (unitElement !== null) unitElement.classList.toggle("hidden", value === null);
}

function setRequiredText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element !== null && element.textContent !== value) element.textContent = value;
}

function setBubbleRiskClass(element: HTMLElement, riskLevel: BubbleRiskLevel | null): void {
  element.classList.remove(
    "bg-rdbg",
    "text-rdtx",
    "bg-ambg",
    "text-am",
    "bg-gnbg",
    "text-gntx",
    "bg-muted",
    "text-muted-foreground",
  );
  if (riskLevel === "HIGH") {
    element.classList.add("bg-rdbg", "text-rdtx");
  } else if (riskLevel === "MEDIUM") {
    element.classList.add("bg-ambg", "text-am");
  } else if (riskLevel === "LOW") {
    element.classList.add("bg-gnbg", "text-gntx");
  } else {
    element.classList.add("bg-muted", "text-muted-foreground");
  }
}

export function DashboardLive({ data }: { data: LiveDashboard | null }) {
  const previousPrices = useRef(new Map<string, number>());

  useEffect(() => {
    if (data === null) return;
    const nowMs = Date.now();

    for (const source of data.sources) {
      const marker = document.querySelector<HTMLElement>(
        `[data-rail-marker="${CSS.escape(source.slug)}"]`,
      );
      if (marker !== null && source.rail_percent !== null) {
        marker.style.right = `${source.rail_percent}%`;
        const stem = marker.querySelector<HTMLElement>("[data-rail-stem]");
        if (stem !== null) stem.style.height = `${source.stem_long ? 38 : 10}px`;
        setPriceText(marker, "[data-rail-price]", source.price_display);
        const name = marker.dataset["railName"];
        if (name !== undefined) {
          marker.setAttribute(
            "aria-label",
            source.price_display === null
              ? `${name} — قیمتی ثبت نشده است`
              : `${name} — ${source.price_display} تومان`,
          );
        }
      }

      const card = document.querySelector<HTMLElement>(
        `[data-source-card="${CSS.escape(source.slug)}"]`,
      );
      if (card === null) continue;
      setPriceText(card, "[data-source-price]", source.price_display);

      // ⚠️ This card's staleness label must **age** with the passage of time,
      // otherwise a platform that has stopped working keeps its number and
      // never becomes "stale". Same pure function the old table used.
      const timeEl = card.querySelector<HTMLElement>('[data-live="updated-at"]');
      const staleEl = card.querySelector<HTMLElement>('[data-live="stale"]');
      if (timeEl !== null) {
        const current = {
          priceText: source.price_display ?? "",
          updatedAtIso: timeEl.getAttribute("datetime"),
          updatedText: timeEl.textContent ?? "",
          staleText: staleEl?.textContent ?? "",
        };
        const next = nextRowDomState(
          current,
          {
            platform_slug: source.slug,
            price_toman: source.price_toman,
            price_display: source.price_display,
            updated_at: source.updated_at,
          },
          nowMs,
        );
        if (next.updatedAtIso !== null && next.updatedAtIso !== current.updatedAtIso) {
          timeEl.setAttribute("datetime", next.updatedAtIso);
        }
        if (next.updatedText !== current.updatedText) timeEl.textContent = next.updatedText;
        if (staleEl !== null && next.staleText !== current.staleText) {
          staleEl.textContent = next.staleText;
        }
      }

      const previous = previousPrices.current.get(source.slug);
      if (source.price_toman !== null) {
        if (previous !== undefined && previous !== source.price_toman) {
          card.style.backgroundColor =
            source.price_toman > previous ? "var(--rdbg)" : "var(--gnbg)";
          window.setTimeout(() => {
            card.style.backgroundColor = "";
          }, FLASH_MS);
        }
        previousPrices.current.set(source.slug, source.price_toman);
      }
    }

    const max = document.querySelector<HTMLElement>("[data-rail-max]");
    if (max !== null && data.max_display !== null) {
      setPriceText(max, "[data-price-value]", data.max_display);
    }
    const min = document.querySelector<HTMLElement>("[data-rail-min]");
    if (min !== null && data.min_display !== null) {
      setPriceText(min, "[data-price-value]", data.min_display);
    }
    const spread = document.querySelector<HTMLElement>("[data-rail-spread]");
    if (spread !== null && data.spread_display !== null) {
      spread.textContent = `بازه اختلاف ${data.spread_display} تومان`;
    }
    setTomanText(document, "[data-bubble-intrinsic]", data.bubble?.intrinsicDisplay ?? null);
    setTomanText(document, "[data-bubble-amount]", data.bubble?.bubbleDisplay ?? null);
    setRequiredText(document, "[data-bubble-percent]", data.bubble?.bubblePercentDisplay ?? "—");
    const riskLevel = data.bubble?.riskLevel ?? null;
    const riskLabel = document.querySelector<HTMLElement>("[data-bubble-risk-label]");
    if (riskLabel !== null) {
      setBubbleRiskClass(riskLabel, riskLevel);
      if (riskLabel.textContent !== (data.bubble?.riskLabel ?? BUBBLE_INPUT_MISSING_FA)) {
        riskLabel.textContent = data.bubble?.riskLabel ?? BUBBLE_INPUT_MISSING_FA;
      }
    }
    const statusPanel = document.querySelector<HTMLElement>("[data-bubble-status-panel]");
    if (statusPanel !== null) setBubbleRiskClass(statusPanel, riskLevel);
    const bubbleStaleness = document.querySelector<HTMLElement>("[data-bubble-staleness]");
    if (bubbleStaleness !== null) {
      const timeEl = bubbleStaleness.querySelector<HTMLElement>('[data-live="updated-at"]');
      const staleEl = bubbleStaleness.querySelector<HTMLElement>('[data-live="stale"]');
      if (timeEl !== null) {
        const current = {
          priceText: "",
          updatedAtIso: timeEl.getAttribute("datetime"),
          updatedText: timeEl.textContent ?? "",
          staleText: staleEl?.textContent ?? "",
        };
        const next = nextRowDomState(
          current,
          {
            platform_slug: "bubble",
            price_toman: null,
            price_display: null,
            updated_at: data.bubble_updated_at,
          },
          nowMs,
        );
        if (next.updatedAtIso !== null && next.updatedAtIso !== current.updatedAtIso) {
          timeEl.setAttribute("datetime", next.updatedAtIso);
        }
        if (next.updatedText !== current.updatedText) timeEl.textContent = next.updatedText;
        if (staleEl !== null && next.staleText !== current.staleText) {
          staleEl.textContent = next.staleText;
        }
      }
    }
    setRequiredText(
      document,
      "[data-bubble-status]",
      data.bubble === null ? "داده اونس یا دلار هنوز در دسترس نیست" : data.bubble.riskDescription,
    );
    for (const coin of data.coinPrices) {
      setTomanText(
        document,
        `[data-coin-price="${CSS.escape(coin.key)}"]`,
        coin.priceDisplay,
        COIN_PRICE_UNCOLLECTED_FA,
      );
    }

    // ⚠️ A reference outage hides the anchor instead of freezing it: a dashed
    // line left at its last position claims a reference price that is no
    // longer being read.
    for (const anchor of document.querySelectorAll<HTMLElement>(".rail-anchor")) {
      if (data.reference_percent === null) {
        anchor.style.display = "none";
        continue;
      }
      anchor.style.display = "";
      anchor.style.right = `${data.reference_percent}%`;
    }

    // ⚠️ The "last updated" label is deliberately **not** written here: it
    // goes through the React props path (`HomePage` ⟸ `PriceRail`), because
    // that same change must also reset the wick's phase. Two writers for one
    // node means one of them will silently win someday.
    const rail = document.querySelector<HTMLElement>("[data-rail]");
    if (rail !== null) {
      rail.classList.remove("rail-flash");
      void rail.offsetWidth;
      rail.classList.add("rail-flash");
    }
  }, [data]);

  return null;
}
