import "@tanstack/react-start/server-only";

import sharp, { type OverlayOptions, type Sharp } from "sharp";

import {
  OG_CARD_BRAND,
  OG_CARD_DOMAIN,
  OG_CARD_LAYOUT,
  OG_CARD_PALETTE,
  clampOgTitle,
  type OgCard,
} from "../../og-card";
import { ogFontFiles, type OgFontFiles } from "./fonts";

/**
 * ⚠️ A queue of its own, deliberately not `server/image-queue.ts`: that one is
 * held for the whole of an admin upload including its S3 round-trip, and the
 * production container has a single core. Sharing it would let one blog-image
 * upload stall every link preview on the site.
 */
let tail: Promise<void> = Promise.resolve();

function enqueueRender<T>(job: () => Promise<T>): Promise<T> {
  const started = tail.then(job);
  tail = started.then(
    () => undefined,
    () => undefined,
  );
  return started;
}

const PANGO_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const RIGHT_TO_LEFT_EMBEDDING = "‫";
const POP_DIRECTIONAL_FORMATTING = "‬";

/**
 * ⚠️ Not cosmetic: an unescaped `&` or `<` in a platform or instrument name
 * makes pango throw «invalid markup in text», which would turn a card into
 * the text-free fallback for no visible reason.
 */
export function escapePangoMarkup(text: string): string {
  return text.replace(/[&<>"']/g, (char) => PANGO_ESCAPES[char] ?? char);
}

/**
 * ⚠️ Pango picks a line's base direction from its first strong character, so a
 * title that happens to start with a Latin word (a platform's English name, a
 * post title opening on «iPhone») lays the whole line out left-to-right and
 * pushes the Persian to the wrong side. Forcing RTL embedding is what keeps
 * every card in the same reading order.
 */
export function forceRtl(text: string): string {
  return `${RIGHT_TO_LEFT_EMBEDDING}${text}${POP_DIRECTIONAL_FORMATTING}`;
}

type Weight = "regular" | "bold";
type Side = "start" | "end";

interface TextRun {
  text: string;
  weight: Weight;
  size: number;
  color: string;
  wrapWidth?: number;
}

interface RenderedRun {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * ⚠️ Persian shaping happens inside libvips' pango/harfbuzz/fribidi stack,
 * which is why every glyph goes through `sharp({ text })` and never through an
 * SVG `<text>` element: librsvg resolves fonts through the global fontconfig
 * only, and the runtime image has no fontconfig config to resolve against.
 * ⚠️ The weight is chosen by the **family name**, not by `fontfile`: font
 * files accumulate in one process-wide app-font set, so asking for
 * «Vazirmatn» while passing the bold file silently renders regular.
 */
async function renderRun(run: TextRun, fonts: OgFontFiles): Promise<RenderedRun> {
  const family = run.weight === "bold" ? "Vazirmatn Bold" : "Vazirmatn";
  const fontfile = run.weight === "bold" ? fonts.bold : fonts.regular;
  const markup = `<span foreground="${run.color}">${forceRtl(escapePangoMarkup(run.text))}</span>`;

  const result = await sharp({
    text: {
      text: markup,
      font: `${family} ${run.size}`,
      fontfile,
      rgba: true,
      dpi: 72,
      align: "right",
      ...(run.wrapWidth === undefined ? {} : { width: run.wrapWidth, wrap: "word" as const }),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

  return { data: result.data, width: result.info.width, height: result.info.height };
}

function leftFor(side: Side, width: number): number {
  return side === "start"
    ? OG_CARD_LAYOUT.width - OG_CARD_LAYOUT.padding - width
    : OG_CARD_LAYOUT.padding;
}

function solid(width: number, height: number, color: string): Sharp {
  return sharp({
    create: {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      channels: 4,
      background: color,
    },
  });
}

async function baseCanvas(): Promise<OverlayOptions[]> {
  const rail = await solid(OG_CARD_LAYOUT.railWidth, OG_CARD_LAYOUT.height, OG_CARD_PALETTE.rail)
    .png()
    .toBuffer();
  return [{ input: rail, left: OG_CARD_LAYOUT.width - OG_CARD_LAYOUT.railWidth, top: 0 }];
}

function canvas(layers: OverlayOptions[]): Promise<Buffer> {
  return solid(OG_CARD_LAYOUT.width, OG_CARD_LAYOUT.height, OG_CARD_PALETTE.background)
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The text-free degradation: no font file, no pango, no shaping — only solid
 * rectangles. It is what `/og/*.png` answers with when the real card cannot be
 * drawn, so a renderer failure stays a plain card instead of a 500.
 */
export function renderOgFallbackCard(): Promise<Buffer> {
  return enqueueRender(async () => {
    const layers = await baseCanvas();
    const markWidth = 320;
    const markHeight = 18;
    const gap = 26;

    for (let index = 0; index < 3; index += 1) {
      const width = markWidth - index * 90;
      const block = await solid(
        width,
        markHeight,
        index === 0 ? OG_CARD_PALETTE.rail : OG_CARD_PALETTE.hairline,
      )
        .png()
        .toBuffer();
      layers.push({
        input: block,
        left: leftFor("start", width),
        top: OG_CARD_LAYOUT.height / 2 - markHeight + index * (markHeight + gap),
      });
    }

    return canvas(layers);
  });
}

/**
 * ⚠️ The price is bottom-anchored and shrinks to fit, it does not flow after
 * the title: a nine-digit toman figure at the largest size is wider than the
 * card, and a two-line title plus a full-height price is taller than 630px.
 * Either one silently overlaps the footnote if both are laid out top-down.
 */
async function fitPrice(
  text: string,
  fonts: OgFontFiles,
  maxWidth: number,
  maxHeight: number,
): Promise<RenderedRun> {
  let smallest: RenderedRun | null = null;
  for (const size of OG_CARD_LAYOUT.priceSizes) {
    const run = await renderRun({ text, weight: "bold", size, color: OG_CARD_PALETTE.price }, fonts);
    smallest = run;
    if (run.width <= maxWidth && run.height <= maxHeight) return run;
  }
  if (smallest === null) throw new Error("no price size candidates configured");
  return smallest;
}

export function renderOgCard(card: OgCard): Promise<Buffer> {
  const fonts = ogFontFiles();
  if (fonts === null) {
    return Promise.reject(
      new Error("OG font files not found in public/fonts — cannot render Persian text"),
    );
  }
  return enqueueRender(() => drawCard(card, fonts));
}

async function drawCard(card: OgCard, fonts: OgFontFiles): Promise<Buffer> {
  const layers = await baseCanvas();
  const contentWidth = OG_CARD_LAYOUT.width - OG_CARD_LAYOUT.padding * 2;

  const brand = await renderRun(
    {
      text: OG_CARD_BRAND,
      weight: "bold",
      size: OG_CARD_LAYOUT.size.brand,
      color: OG_CARD_PALETTE.brand,
    },
    fonts,
  );
  layers.push({
    input: brand.data,
    left: leftFor("start", brand.width),
    top: OG_CARD_LAYOUT.brandTop,
  });

  const domain = await renderRun(
    {
      text: OG_CARD_DOMAIN,
      weight: "regular",
      size: OG_CARD_LAYOUT.size.domain,
      color: OG_CARD_PALETTE.muted,
    },
    fonts,
  );
  layers.push({
    input: domain.data,
    left: leftFor("end", domain.width),
    top: OG_CARD_LAYOUT.brandTop + (brand.height - domain.height) / 2,
  });

  const eyebrow = await renderRun(
    {
      text: card.eyebrow,
      weight: "regular",
      size: OG_CARD_LAYOUT.size.eyebrow,
      color: OG_CARD_PALETTE.muted,
    },
    fonts,
  );
  layers.push({
    input: eyebrow.data,
    left: leftFor("start", eyebrow.width),
    top: OG_CARD_LAYOUT.bodyTop,
  });

  const titleTop = OG_CARD_LAYOUT.bodyTop + eyebrow.height + OG_CARD_LAYOUT.gapAfterEyebrow;
  const title = await renderRun(
    {
      text: clampOgTitle(card.title),
      weight: "bold",
      size: OG_CARD_LAYOUT.size.title,
      color: OG_CARD_PALETTE.title,
      wrapWidth: contentWidth,
    },
    fonts,
  );
  layers.push({ input: title.data, left: leftFor("start", title.width), top: titleTop });

  const footnote = await renderRun(
    {
      text: card.footnote,
      weight: "regular",
      size: OG_CARD_LAYOUT.size.footnote,
      color: OG_CARD_PALETTE.muted,
    },
    fonts,
  );
  const footnoteTop = OG_CARD_LAYOUT.height - OG_CARD_LAYOUT.footnoteBottom - footnote.height;
  layers.push({ input: footnote.data, left: leftFor("start", footnote.width), top: footnoteTop });

  const hairlineTop = footnoteTop - OG_CARD_LAYOUT.gapAfterHairline;
  const hairline = await solid(contentWidth, 1, OG_CARD_PALETTE.hairline).png().toBuffer();
  layers.push({ input: hairline, left: OG_CARD_LAYOUT.padding, top: hairlineTop });

  if (card.price !== null) {
    const priceCeiling = titleTop + title.height + OG_CARD_LAYOUT.gapAfterEyebrow;
    const price = await fitPrice(
      card.price,
      fonts,
      contentWidth,
      hairlineTop - OG_CARD_LAYOUT.gapBeforeHairline - priceCeiling,
    );
    layers.push({
      input: price.data,
      left: leftFor("start", price.width),
      top: Math.max(priceCeiling, hairlineTop - OG_CARD_LAYOUT.gapBeforeHairline - price.height),
    });
  }

  return canvas(layers);
}
