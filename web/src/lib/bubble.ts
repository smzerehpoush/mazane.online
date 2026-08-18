import { formatFaNumber, formatFaPercentFromFraction } from "./fa-number";

const TROY_OUNCE_GRAMS = 31.1034768;
const GOLD_18K_PURITY = 0.75;
const MEDIUM_RISK_THRESHOLD = 0.03;
const HIGH_RISK_THRESHOLD = 0.08;

export type BubbleRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BubbleInputs {
  marketPriceToman: number | null;
  ounceUsd: number | null;
  usdToman: number | null;
}

export interface BubbleView {
  intrinsicToman: number;
  bubbleToman: number;
  bubbleFraction: number;
  intrinsicDisplay: string;
  bubbleDisplay: string;
  bubblePercentDisplay: string;
  riskLevel: BubbleRiskLevel;
  riskLabel: string;
  riskDescription: string;
}

function validPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function bubbleRisk(bubbleFraction: number): {
  riskLevel: BubbleRiskLevel;
  riskLabel: string;
  riskDescription: string;
} {
  if (bubbleFraction > HIGH_RISK_THRESHOLD) {
    return {
      riskLevel: "HIGH",
      riskLabel: "پرریسک",
      riskDescription: "حباب خیلی بالاتر از قیمت ذاتی است",
    };
  }
  if (bubbleFraction > MEDIUM_RISK_THRESHOLD) {
    return {
      riskLevel: "MEDIUM",
      riskLabel: "ریسک متوسط",
      riskDescription: "حباب محسوس است؛ با احتیاط تصمیم بگیرید",
    };
  }
  return {
    riskLevel: "LOW",
    riskLabel: "کم‌ریسک",
    riskDescription:
      bubbleFraction < 0 ? "قیمت کمتر از ارزش ذاتی محاسبه‌شده است" : "حباب محدود است",
  };
}

function bubbleView(marketPriceToman: number, intrinsicToman: number): BubbleView | null {
  if (intrinsicToman <= 0) return null;

  const bubbleToman = Math.round(marketPriceToman - intrinsicToman);
  const bubbleFraction = bubbleToman / intrinsicToman;
  const risk = bubbleRisk(bubbleFraction);

  return {
    intrinsicToman,
    bubbleToman,
    bubbleFraction,
    intrinsicDisplay: formatFaNumber(intrinsicToman),
    bubbleDisplay: formatFaNumber(bubbleToman, { signDisplay: "exceptZero" }),
    bubblePercentDisplay: formatFaPercentFromFraction(bubbleFraction, {
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }),
    ...risk,
  };
}

export function calculateBubble(input: BubbleInputs): BubbleView | null {
  if (
    !validPositive(input.marketPriceToman) ||
    !validPositive(input.ounceUsd) ||
    !validPositive(input.usdToman)
  ) {
    return null;
  }

  return bubbleView(
    input.marketPriceToman,
    Math.round((input.ounceUsd * input.usdToman * GOLD_18K_PURITY) / TROY_OUNCE_GRAMS),
  );
}

export interface CoinBubbleInputs {
  coinPriceToman: number | null;
  pureGoldGrams: number | null;
  ounceUsd: number | null;
  usdToman: number | null;
}

export function calculateCoinBubble(input: CoinBubbleInputs): BubbleView | null {
  if (
    !validPositive(input.coinPriceToman) ||
    !validPositive(input.pureGoldGrams) ||
    !validPositive(input.ounceUsd) ||
    !validPositive(input.usdToman)
  ) {
    return null;
  }

  return bubbleView(
    input.coinPriceToman,
    Math.round((input.ounceUsd * input.usdToman * input.pureGoldGrams) / TROY_OUNCE_GRAMS),
  );
}
