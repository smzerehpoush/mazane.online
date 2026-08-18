import { OG_CARD_BRAND, OG_CARD_DOMAIN, OG_CARD_PALETTE } from "./og-card";
import { SITE_URL } from "./site";

export const SHARE_BUTTON_LABEL = "تصویر نتیجه را بگیر";
export const SHARE_BUSY_LABEL = "در حال ساختن تصویر…";
export const SHARE_FAILED_LABEL = "تصویر ساخته نشد، دوباره تلاش کنید";
export const SHARE_HINT =
  "تصویر روی همین دستگاه ساخته می‌شود و عددهای شما به سرور تابلو فرستاده نمی‌شود.";
export const SHARE_FILE_NAME = "tablo-result.png";

export interface ShareCardLine {
  label: string;
  value: string;
}

export interface ShareCard {
  title: string;
  lines: readonly ShareCardLine[];
  total: ShareCardLine;
  note: string | null;
  pagePath: string;
}

export const SHARE_CARD_LAYOUT = {
  width: 1080,
  padding: 72,
  railWidth: 12,
  headerTop: 74,
  titleTop: 186,
  gapAfterTitle: 54,
  rowHeight: 74,
  gapBeforeTotal: 26,
  totalHeight: 132,
  gapAfterTotal: 34,
  noteHeight: 56,
  footerHeight: 96,
  size: {
    brand: 40,
    domain: 26,
    title: 50,
    row: 32,
    totalLabel: 30,
    totalValue: 60,
    note: 24,
    footer: 28,
  },
} as const;

export function shareCardHeight(card: ShareCard): number {
  const l = SHARE_CARD_LAYOUT;
  const rows = card.lines.length * l.rowHeight;
  const note = card.note === null ? 0 : l.noteHeight;
  return (
    l.titleTop +
    l.size.title +
    l.gapAfterTitle +
    rows +
    l.gapBeforeTotal +
    l.totalHeight +
    l.gapAfterTotal +
    note +
    l.footerHeight
  );
}

export function shareCardWatermark(pagePath: string): string {
  return `${SITE_URL.replace(/^https?:\/\//, "")}${pagePath}`;
}

/**
 * ⚠️ A structural subset of `CanvasRenderingContext2D` rather than the type
 * itself: the drawing is unit-tested in the node environment, where there is
 * no canvas to get a real context from, so the tests hand it a recorder. A
 * real 2D context satisfies this as-is, with no cast at the call site.
 */
export interface ShareCardContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

export const SHARE_CARD_ELLIPSIS = "…";
export const SHARE_ROW_GAP = 28;

/**
 * ⚠️ Canvas neither wraps nor clips: text past the edge is simply painted off
 * the bitmap, and a label and its amount grow toward each other with nothing
 * to stop them overlapping. Every string on this card goes through here, so
 * that a longer label added later degrades to an ellipsis instead of silently
 * producing a corrupt image nobody notices until it is in a WhatsApp group.
 */
export function elideToWidth(ctx: ShareCardContext, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;

  for (let cut = text.length - 1; cut > 0; cut -= 1) {
    const candidate = `${text.slice(0, cut).trimEnd()}${SHARE_CARD_ELLIPSIS}`;
    if (ctx.measureText(candidate).width <= maxWidth) return candidate;
  }
  return SHARE_CARD_ELLIPSIS;
}

export function shareCardFont(weight: 400 | 700, size: number): string {
  return `${weight} ${size}px Vazirmatn, sans-serif`;
}

/**
 * ⚠️ The whole card is drawn right-to-left on purpose: `direction = "rtl"`
 * plus a right `textAlign` is what makes the browser's own bidi pass put a
 * Persian label at the right edge and keep a Persian-digit amount readable
 * next to it. Dropping either one flips the card to Latin order.
 */
export function drawShareCard(ctx: ShareCardContext, card: ShareCard): number {
  const l = SHARE_CARD_LAYOUT;
  const height = shareCardHeight(card);
  const right = l.width - l.padding;
  const left = l.padding;

  ctx.fillStyle = OG_CARD_PALETTE.background;
  ctx.fillRect(0, 0, l.width, height);
  ctx.fillStyle = OG_CARD_PALETTE.rail;
  ctx.fillRect(l.width - l.railWidth, 0, l.railWidth, height);

  ctx.direction = "rtl";
  ctx.textBaseline = "top";

  ctx.textAlign = "right";
  ctx.fillStyle = OG_CARD_PALETTE.brand;
  ctx.font = shareCardFont(700, l.size.brand);
  ctx.fillText(OG_CARD_BRAND, right, l.headerTop);

  ctx.textAlign = "left";
  ctx.fillStyle = OG_CARD_PALETTE.muted;
  ctx.font = shareCardFont(400, l.size.domain);
  ctx.fillText(OG_CARD_DOMAIN, left, l.headerTop + 12);

  const contentWidth = l.width - l.padding * 2;

  ctx.textAlign = "right";
  ctx.fillStyle = OG_CARD_PALETTE.title;
  ctx.font = shareCardFont(700, l.size.title);
  ctx.fillText(elideToWidth(ctx, card.title, contentWidth), right, l.titleTop);

  let cursor = l.titleTop + l.size.title + l.gapAfterTitle;

  for (const line of card.lines) {
    ctx.fillStyle = OG_CARD_PALETTE.hairline;
    ctx.fillRect(left, cursor - 1, l.width - l.padding * 2, 1);

    ctx.font = shareCardFont(400, l.size.row);
    const valueWidth = ctx.measureText(line.value).width;

    ctx.textAlign = "right";
    ctx.fillStyle = OG_CARD_PALETTE.muted;
    ctx.fillText(
      elideToWidth(ctx, line.label, contentWidth - valueWidth - SHARE_ROW_GAP),
      right,
      cursor + 22,
    );

    ctx.textAlign = "left";
    ctx.fillStyle = OG_CARD_PALETTE.title;
    ctx.fillText(elideToWidth(ctx, line.value, contentWidth), left, cursor + 22);

    cursor += l.rowHeight;
  }

  cursor += l.gapBeforeTotal;
  ctx.fillStyle = OG_CARD_PALETTE.hairline;
  ctx.fillRect(left, cursor, l.width - l.padding * 2, l.totalHeight);

  const totalWidth = contentWidth - 48;

  ctx.textAlign = "right";
  ctx.fillStyle = OG_CARD_PALETTE.muted;
  ctx.font = shareCardFont(400, l.size.totalLabel);
  ctx.fillText(elideToWidth(ctx, card.total.label, totalWidth), right - 24, cursor + 22);

  ctx.fillStyle = OG_CARD_PALETTE.price;
  ctx.font = shareCardFont(700, l.size.totalValue);
  ctx.fillText(elideToWidth(ctx, card.total.value, totalWidth), right - 24, cursor + 58);

  cursor += l.totalHeight + l.gapAfterTotal;

  if (card.note !== null) {
    ctx.textAlign = "right";
    ctx.fillStyle = OG_CARD_PALETTE.muted;
    ctx.font = shareCardFont(400, l.size.note);
    ctx.fillText(elideToWidth(ctx, card.note, contentWidth), right, cursor);
    cursor += l.noteHeight;
  }

  ctx.textAlign = "right";
  ctx.fillStyle = OG_CARD_PALETTE.rail;
  ctx.font = shareCardFont(700, l.size.footer);
  ctx.fillText(shareCardWatermark(card.pagePath), right, cursor + 10);

  return height;
}
