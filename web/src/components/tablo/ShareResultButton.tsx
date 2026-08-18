import { useState } from "react";

import {
  SHARE_BUSY_LABEL,
  SHARE_BUTTON_LABEL,
  SHARE_CARD_LAYOUT,
  SHARE_FAILED_LABEL,
  SHARE_FILE_NAME,
  SHARE_HINT,
  drawShareCard,
  shareCardFont,
  shareCardHeight,
  type ShareCard,
} from "@/lib/share-card";

/**
 * ⚠️ The card is drawn in the visitor's own browser and never posted anywhere.
 * The numbers on it are somebody's invoice — weight, wage, dealer profit, the
 * amount they were quoted — and the moment they travel to a server to be drawn
 * they exist in a request body, an access log and a render cache. Moving this
 * to the `/og/*.png` renderer would be a privacy regression, not a reuse win.
 */
async function renderShareImage(card: ShareCard): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_LAYOUT.width;
  canvas.height = shareCardHeight(card);

  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2d canvas context is unavailable");

  // ⚠️ Without this await the first share on a cold page draws in the fallback
  // font: `font-display: swap` means Vazirmatn may not be resolved yet, and
  // canvas silently substitutes instead of waiting like the DOM does.
  const fonts = document.fonts;
  if (fonts !== undefined) {
    await Promise.all([
      fonts.load(shareCardFont(400, SHARE_CARD_LAYOUT.size.row)),
      fonts.load(shareCardFont(700, SHARE_CARD_LAYOUT.size.totalValue)),
    ]);
  }

  drawShareCard(context, card);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (blob === null) throw new Error("canvas produced no image");
  return blob;
}

function wasCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function shareOrDownload(card: ShareCard, blob: Blob): Promise<void> {
  const file = new File([blob], SHARE_FILE_NAME, { type: "image/png" });
  const payload = { files: [file], title: card.title };

  if (navigator.canShare?.(payload) === true) {
    await navigator.share(payload);
    return;
  }

  // ⚠️ The revoke is deferred and the anchor is really in the document: this
  // is the desktop path (`canShare` with files is effectively mobile-only), and
  // revoking the blob URL on the next line after `click()` cancels the download
  // in some browsers before it has read the blob.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = SHARE_FILE_NAME;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function ShareResultButton({ card }: { card: ShareCard | null }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  if (card === null) return null;

  const onClick = async (): Promise<void> => {
    setState("busy");
    try {
      await shareOrDownload(card, await renderShareImage(card));
      setState("idle");
    } catch (error) {
      if (wasCancelled(error)) {
        setState("idle");
        return;
      }
      console.error("share card failed", error);
      setState("failed");
    }
  };

  return (
    <div data-share-result className="mt-3">
      <button
        type="button"
        data-share-result-button
        disabled={state === "busy"}
        onClick={() => {
          void onClick();
        }}
        className="transition-smooth inline-flex min-h-11 items-center justify-center rounded-[12px] border border-gold/40 bg-gold-soft px-4 py-2.5 text-[13px] font-semibold text-gold hover:border-gold disabled:opacity-60"
      >
        {state === "busy" ? SHARE_BUSY_LABEL : SHARE_BUTTON_LABEL}
      </button>

      {state === "failed" && (
        <p data-share-result-error className="mt-2 text-[11.5px] leading-5 text-rd">
          {SHARE_FAILED_LABEL}
        </p>
      )}

      <p data-share-result-hint className="mt-2 text-[11px] leading-5 text-tx3">
        {SHARE_HINT}
      </p>
    </div>
  );
}
