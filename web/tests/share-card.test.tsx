import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { JewelryResult, jewelryShareCard } from "../src/components/tablo/JewelryCalculator";
import {
  SellBackResult,
  sellBackShareCard,
  type SellBackForm,
} from "../src/components/tablo/SellBackCalculator";
import { ShareResultButton } from "../src/components/tablo/ShareResultButton";
import { jewelryBreakdown } from "../src/lib/calculator";
import { JEWELRY_TOOL_PATH } from "../src/lib/jewelry-tool";
import { sellBackBreakdown } from "../src/lib/sell-back";
import {
  SHARE_BUTTON_LABEL,
  SHARE_HINT,
  drawShareCard,
  shareCardHeight,
  shareCardWatermark,
  type ShareCard,
  type ShareCardContext,
} from "../src/lib/share-card";
import { SITE_URL } from "../src/lib/site";

const BREAKDOWN = jewelryBreakdown({
  weightGrams: 5,
  pricePerGram: 10_000_000,
  wagePercent: 12,
  profitPercent: 7,
  vatPercent: 10,
});

const SELL_BACK_FORM: SellBackForm = {
  initial: {},
  values: {},
  setValue: () => {},
  breakdown: sellBackBreakdown({
    weightGrams: 5,
    pricePerGram18k: 10_000_000,
    purityPerMille: 750,
    deductionPercent: 10,
  }),
  deductionEntered: true,
  pricePerGram: 10_000_000,
};

interface Call {
  op: "text" | "rect";
  text?: string;
  x: number;
  y: number;
  fillStyle: string;
  font: string;
  textAlign: string;
  direction: string;
}

class Recorder implements ShareCardContext {
  fillStyle = "";
  font = "";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";
  direction: CanvasDirection = "inherit";
  readonly calls: Call[] = [];

  private snapshot(op: Call["op"], x: number, y: number): Call {
    return {
      op,
      x,
      y,
      fillStyle: String(this.fillStyle),
      font: this.font,
      textAlign: this.textAlign,
      direction: this.direction,
    };
  }

  fillRect(x: number, y: number): void {
    this.calls.push(this.snapshot("rect", x, y));
  }

  fillText(text: string, x: number, y: number): void {
    this.calls.push({ ...this.snapshot("text", x, y), text });
  }
}

function draw(card: ShareCard): Recorder {
  const recorder = new Recorder();
  drawShareCard(recorder, card);
  return recorder;
}

function texts(recorder: Recorder): string[] {
  return recorder.calls.filter((call) => call.op === "text").map((call) => call.text ?? "");
}

describe("the share card a visitor makes of their own result", () => {
  it("carries every line of the breakdown the page shows", () => {
    const card = jewelryShareCard(BREAKDOWN, 10_000_000);
    expect(card).not.toBeNull();
    const drawn = texts(draw(card as ShareCard));
    expect(drawn).toContain("ارزش طلای خام");
    expect(drawn).toContain("اجرت ساخت");
    expect(drawn).toContain("سود فروشنده");
    expect(drawn).toContain("مالیات بر ارزش افزوده");
    expect(drawn).toContain("مبلغ نهایی (تومان)");
  });

  it("carries the site address so the image can travel on its own", () => {
    const card = jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard;
    expect(shareCardWatermark(JEWELRY_TOOL_PATH)).toBe("tablo.gold/mohasebe-tala");
    expect(texts(draw(card))).toContain("tablo.gold/mohasebe-tala");
    expect(SITE_URL).toBe("https://tablo.gold");
  });

  it("names the brand and the rate the numbers were built on", () => {
    const drawn = texts(draw(jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard));
    expect(drawn).toContain("تابلو");
    expect(drawn).toContain("tablo.gold");
    expect(drawn.some((line) => line.includes("نرخ هر گرم طلای ۱۸ عیار"))).toBe(true);
  });

  it("drops the rate note rather than inventing one when no rate is known", () => {
    const card = jewelryShareCard(BREAKDOWN, null) as ShareCard;
    expect(card.note).toBeNull();
    expect(shareCardHeight(card)).toBeLessThan(
      shareCardHeight(jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard),
    );
  });

  it("has no card at all before there is a result", () => {
    expect(jewelryShareCard(null, 10_000_000)).toBeNull();
    expect(sellBackShareCard({ ...SELL_BACK_FORM, breakdown: null })).toBeNull();
  });

  it("builds a sell-back card from the same shape", () => {
    const card = sellBackShareCard(SELL_BACK_FORM) as ShareCard;
    expect(card.pagePath).toBe("/mohasebe-forush-tala");
    const drawn = texts(draw(card));
    expect(drawn).toContain("مبلغی که به شما می‌رسد (تومان)");
    expect(drawn).toContain("tablo.gold/mohasebe-forush-tala");
  });

  /**
   * ⚠️ Persian on a canvas is shaped by the browser, but the base direction is
   * not: without `direction = "rtl"` a label runs off the wrong edge and a
   * mixed Persian/Latin line reorders. Every text call must be made with the
   * RTL base set.
   */
  it("draws every word with an RTL base direction", () => {
    const recorder = draw(jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard);
    const textCalls = recorder.calls.filter((call) => call.op === "text");
    expect(textCalls.length).toBeGreaterThan(5);
    expect(textCalls.every((call) => call.direction === "rtl")).toBe(true);
    expect(recorder.textBaseline).toBe("top");
  });

  it("pins Persian labels to the right edge and their amounts to the left", () => {
    const recorder = draw(jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard);
    const label = recorder.calls.find((call) => call.text === "اجرت ساخت");
    const total = recorder.calls.find((call) => call.text === "مبلغ نهایی (تومان)");
    expect(label?.textAlign).toBe("right");
    expect(total?.textAlign).toBe("right");
    expect(label?.x).toBeGreaterThan(540);
  });

  it("asks for Vazirmatn, the font the site already self-hosts", () => {
    const recorder = draw(jewelryShareCard(BREAKDOWN, 10_000_000) as ShareCard);
    const fonts = recorder.calls.filter((call) => call.op === "text").map((call) => call.font);
    expect(fonts.every((font) => font.includes("Vazirmatn"))).toBe(true);
  });

  it("grows with the number of lines instead of clipping them", () => {
    const base: ShareCard = {
      title: "الف",
      lines: [{ label: "ب", value: "۱" }],
      total: { label: "ج", value: "۲" },
      note: null,
      pagePath: "/mohasebe-tala",
    };
    const taller: ShareCard = { ...base, lines: [...base.lines, { label: "د", value: "۳" }] };
    expect(shareCardHeight(taller)).toBeGreaterThan(shareCardHeight(base));
  });
});

describe("the share button on a tool result", () => {
  it("offers the Persian label once there is a result", () => {
    const html = renderToStaticMarkup(
      <ShareResultButton card={jewelryShareCard(BREAKDOWN, 10_000_000)} />,
    );
    expect(html).toContain(SHARE_BUTTON_LABEL);
    expect(html).toContain("data-share-result-button");
  });

  it("says out loud that the numbers stay on the device", () => {
    const html = renderToStaticMarkup(
      <ShareResultButton card={jewelryShareCard(BREAKDOWN, 10_000_000)} />,
    );
    expect(html).toContain(SHARE_HINT);
    expect(SHARE_HINT).toContain("فرستاده نمی‌شود");
  });

  it("stays out of the way until the visitor has a result", () => {
    expect(renderToStaticMarkup(<ShareResultButton card={null} />)).toBe("");
  });

  it("appears on both tool result blocks", () => {
    const jewelry = renderToStaticMarkup(
      <JewelryResult breakdown={BREAKDOWN} pricePerGram={10_000_000} />,
    );
    const sellBack = renderToStaticMarkup(<SellBackResult form={SELL_BACK_FORM} />);
    expect(jewelry).toContain(SHARE_BUTTON_LABEL);
    expect(sellBack).toContain(SHARE_BUTTON_LABEL);
  });

  it("is absent from a result block with nothing in it", () => {
    const empty = renderToStaticMarkup(<JewelryResult breakdown={null} />);
    expect(empty).not.toContain(SHARE_BUTTON_LABEL);
  });
});
