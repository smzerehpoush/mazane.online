import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./og";

export interface OgCard {
  eyebrow: string;
  title: string;
  price: string | null;
  footnote: string;
}

export const OG_CARD_BRAND = "تابلو";
export const OG_CARD_DOMAIN = "tablo.gold";
export const OG_CARD_NO_PRICE = "نرخ تازه در این لحظه در دسترس نیست";
export const OG_CARD_TOMAN = "تومان";
export const OG_CARD_TITLE_MAX_CHARS = 58;

export const OG_CARD_PALETTE = {
  background: "#0d0f13",
  rail: "#e0b063",
  hairline: "#252932",
  title: "#e9ebef",
  price: "#e0b063",
  muted: "#8b94a1",
  brand: "#e0b063",
} as const;

export const OG_CARD_LAYOUT = {
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  padding: 76,
  railWidth: 14,
  brandTop: 58,
  bodyTop: 176,
  gapAfterEyebrow: 16,
  gapBeforeHairline: 30,
  gapAfterHairline: 26,
  footnoteBottom: 54,
  size: {
    brand: 38,
    domain: 24,
    eyebrow: 28,
    title: 46,
    footnote: 24,
  },
  priceSizes: [78, 68, 58, 48] as const,
} as const;

export function clampOgTitle(title: string, maxChars: number = OG_CARD_TITLE_MAX_CHARS): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

export function ogPriceLine(display: string | null): string | null {
  return display === null ? null : `${display} ${OG_CARD_TOMAN}`;
}

export interface OgFootnoteInput {
  sourceName: string;
  clock: string | null;
  hasPrice: boolean;
}

export function ogFootnote(input: OgFootnoteInput): string {
  if (!input.hasPrice) return OG_CARD_NO_PRICE;
  const source = `منبع نرخ: ${input.sourceName}`;
  return input.clock === null ? source : `${source} · آخرین ثبت ${input.clock}`;
}
