import { useState } from "react";

import { CALC_TOOL_SELLBACK } from "@/lib/calc-events";
import { parseCalculatorInput } from "@/lib/calculator";
import { formatFaNumber, formatFaPercentPoints } from "@/lib/fa-number";
import { formatDateTimeFa } from "@/lib/format";
import {
  DEFAULT_SELL_BACK_PURITY,
  SELL_BACK_KARATS,
  sellBackBreakdown,
  type SellBackBreakdown,
} from "@/lib/sell-back";
import type { ShareCard } from "@/lib/share-card";
import { useCalcEvents } from "@/lib/use-calc-events";
import { ShareResultButton } from "@/components/tablo/ShareResultButton";

const LABELS = {
  weight: "وزن (گرم)",
  purity: "عیار",
  deduction: "کسر خریدار (٪)",
  pureGold: "طلای خالص این قطعه",
  goldValue: "ارزش طلا به نرخ امروز",
  deductionAmount: "کسر خریدار",
  payout: "مبلغی که به شما می‌رسد (تومان)",
  share: "سهم شما از ارزش طلا",
  gram: "گرم",
  toman: "تومان",
  rate: "نرخ هر گرم طلای ۱۸ عیار",
  reference: "مرجع",
  readAt: "آخرین ثبت",
} as const;

const DEDUCTION_NOTE =
  "برای درصدی که خریدار از ارزش طلا کم می‌کند نرخ‌نامه‌ای اعلام نشده است؛ این عدد از مغازه‌ای تا مغازه‌ی دیگر فرق می‌کند. رقمی را که به شما پیشنهاد شده وارد کنید.";

const CEILING_NOTE =
  "تا وقتی درصد کسر را وارد نکنید، مبلغی که می‌بینید سقف است: ارزش خود طلا، بدون هیچ کسری.";

const PURITY_NOTE =
  "عیار یعنی هر گرم قطعه چقدر طلای خالص دارد: ۱۸ عیار ۷۵۰ هزارم و ۲۱ عیار ۸۷۵ هزارم. نرخ پایه‌ی این صفحه نرخ هر گرم طلای ۱۸ عیار است و عیارهای دیگر با نسبت عیار به ۷۵۰ حساب می‌شوند. سکه، شمش و طلای آب‌شده نرخ مستقل خودشان را دارند و این ماشین‌حساب برای آن‌ها نیست.";

const NO_RATE_NOTE =
  "نرخ مرجع هر گرم طلای ۱۸ عیار در این لحظه در دسترس نیست، پس مبلغ محاسبه نمی‌شود. چند دقیقه‌ی دیگر دوباره امتحان کنید.";

const SHARE_TITLE = "فروش طلای دست‌دوم";
const SELL_BACK_PATH = "/mohasebe-forush-tala";

export interface SellBackForm {
  initial: Record<string, string>;
  values: Record<string, string>;
  setValue(key: string, value: string): void;
  breakdown: SellBackBreakdown | null;
  deductionEntered: boolean;
  pricePerGram: number | null;
}

function initialValues(): Record<string, string> {
  return {
    weight: "",
    purity: String(DEFAULT_SELL_BACK_PURITY),
    deduction: "",
  };
}

export function useSellBackForm(pricePerGram: number | null): SellBackForm {
  const [initial] = useState<Record<string, string>>(initialValues);
  const [values, setValues] = useState<Record<string, string>>(initial);

  const weight = parseCalculatorInput(values["weight"] ?? "");
  const deduction = parseCalculatorInput(values["deduction"] ?? "");
  const purity = Number(values["purity"] ?? DEFAULT_SELL_BACK_PURITY);

  const breakdown =
    weight === null || pricePerGram === null
      ? null
      : sellBackBreakdown({
          weightGrams: weight,
          pricePerGram18k: pricePerGram,
          purityPerMille: purity,
          deductionPercent: deduction ?? 0,
        });

  useCalcEvents({
    tool: CALC_TOOL_SELLBACK,
    initial,
    values,
    hasResult: breakdown !== null,
  });

  return {
    initial,
    values,
    setValue: (key, value) => setValues((previous) => ({ ...previous, [key]: value })),
    breakdown,
    deductionEntered: deduction !== null,
    pricePerGram,
  };
}

export function SellBackInputs({
  form,
  referenceName,
  readAt,
}: {
  form: SellBackForm;
  referenceName: string;
  readAt: string | null;
}) {
  return (
    <section data-card="calculator" className="card-surface px-5 py-4 sm:px-6">
      {form.pricePerGram !== null && (
        <p data-calculator-rate className="mb-3 text-meta text-tx3">
          {`${LABELS.rate}: `}
          <span className="num font-semibold text-foreground">
            {formatFaNumber(form.pricePerGram)}
          </span>
          {` ${LABELS.toman} · ${LABELS.reference} ${referenceName}`}
          {readAt !== null && (
            <>
              {` · ${LABELS.readAt} `}
              <time dateTime={readAt}>{formatDateTimeFa(readAt)}</time>
            </>
          )}
        </p>
      )}

      <div className="space-y-2.5">
        <label className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-body focus-within:border-primary">
          <span className="shrink-0 text-tx3">{LABELS.weight}</span>
          <input
            name="weight"
            inputMode="decimal"
            value={form.values["weight"] ?? ""}
            onChange={(event) => form.setValue("weight", event.target.value)}
            className="num w-20 bg-transparent text-left outline-none"
            dir="ltr"
          />
        </label>

        <label className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-body focus-within:border-primary">
          <span className="shrink-0 text-tx3">{LABELS.purity}</span>
          <select
            name="purity"
            value={form.values["purity"] ?? String(DEFAULT_SELL_BACK_PURITY)}
            onChange={(event) => form.setValue("purity", event.target.value)}
            className="bg-transparent text-left outline-none"
          >
            {SELL_BACK_KARATS.map((option) => (
              <option key={option.karat} value={option.purityPerMille}>
                {`${formatFaNumber(option.karat)} عیار (${formatFaNumber(option.purityPerMille)})`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-body focus-within:border-primary">
          <span className="shrink-0 text-tx3">{LABELS.deduction}</span>
          <input
            name="deduction"
            inputMode="decimal"
            value={form.values["deduction"] ?? ""}
            onChange={(event) => form.setValue("deduction", event.target.value)}
            className="num w-20 bg-transparent text-left outline-none"
            dir="ltr"
          />
        </label>
      </div>

      <p data-calculator-deduction-note className="mt-3 text-meta text-tx3">
        {DEDUCTION_NOTE}
      </p>

      <p className="mt-2 text-meta text-tx3">{PURITY_NOTE}</p>
    </section>
  );
}

export function sellBackShareCard(form: SellBackForm): ShareCard | null {
  const { breakdown } = form;
  if (breakdown === null) return null;
  return {
    title: SHARE_TITLE,
    lines: [
      {
        label: LABELS.pureGold,
        value: `${formatFaNumber(breakdown.pureGoldGrams, { maximumFractionDigits: 3 })} ${LABELS.gram}`,
      },
      { label: LABELS.goldValue, value: formatFaNumber(breakdown.goldValue) },
      { label: LABELS.deductionAmount, value: formatFaNumber(breakdown.deduction) },
      ...(breakdown.payoutSharePercent === null
        ? []
        : [
            {
              label: LABELS.share,
              value: formatFaPercentPoints(breakdown.payoutSharePercent, {
                maximumFractionDigits: 1,
              }),
            },
          ]),
    ],
    total: { label: LABELS.payout, value: formatFaNumber(breakdown.payout) },
    note:
      form.pricePerGram === null
        ? null
        : `${LABELS.rate}: ${formatFaNumber(form.pricePerGram)} ${LABELS.toman}`,
    pagePath: SELL_BACK_PATH,
  };
}

export function SellBackResult({ form }: { form: SellBackForm }) {
  const { breakdown } = form;
  const share = breakdown?.payoutSharePercent ?? null;

  return (
    <section className="card-surface px-5 py-4 sm:px-6">
      {breakdown !== null && (
        <dl
          data-calculator-breakdown
          className="rounded-[10px] border border-line2 px-3.5 py-2.5 text-meta"
        >
          <div className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-tx3">{LABELS.pureGold}</dt>
            <dd data-breakdown-line="pure-gold" className="num">
              {`${formatFaNumber(breakdown.pureGoldGrams, { maximumFractionDigits: 3 })} ${LABELS.gram}`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-tx3">{LABELS.goldValue}</dt>
            <dd data-breakdown-line="gold-value" className="num">
              {formatFaNumber(breakdown.goldValue)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-tx3">{LABELS.deductionAmount}</dt>
            <dd data-breakdown-line="deduction" className="num">
              {formatFaNumber(breakdown.deduction)}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-2.5 rounded-[10px] bg-acbg p-4">
        <div className="flex items-center justify-between">
          <span className="text-meta text-actx">{LABELS.payout}</span>
          <span data-calculator-total className="num text-xl font-semibold text-actx">
            {breakdown === null ? "—" : formatFaNumber(breakdown.payout)}
          </span>
        </div>

        {share !== null && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-actx/20 pt-2.5">
            <span className="text-meta text-actx">{LABELS.share}</span>
            <span data-calculator-share className="num text-body font-semibold text-actx">
              {formatFaPercentPoints(share, { maximumFractionDigits: 1 })}
            </span>
          </div>
        )}
      </div>

      {form.pricePerGram === null && (
        <p data-calculator-no-rate className="mt-2.5 text-meta text-tx3">
          {NO_RATE_NOTE}
        </p>
      )}

      {breakdown !== null && !form.deductionEntered && (
        <p data-calculator-ceiling-note className="mt-2.5 text-meta text-tx3">
          {CEILING_NOTE}
        </p>
      )}

      <ShareResultButton card={sellBackShareCard(form)} />
    </section>
  );
}
