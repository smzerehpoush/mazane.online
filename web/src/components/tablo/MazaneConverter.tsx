import { useState } from "react";

import { ShareResultButton } from "@/components/tablo/ShareResultButton";
import { CALC_TOOL_MAZANE } from "@/lib/calc-events";
import { parseCalculatorInput } from "@/lib/calculator";
import { formatFaNumber } from "@/lib/fa-number";
import {
  convertMazane,
  MESGHAL_GRAMS,
  MESGHAL_IN_18K_GRAMS,
  type MazaneDirection,
} from "@/lib/mazane";
import type { ShareCard } from "@/lib/share-card";
import { useCalcEvents } from "@/lib/use-calc-events";

export const MAZANE_TOOL_PATH = "/tabdil-mazane";

const LABELS = {
  direction: "چه چیزی را دارید؟",
  mazaneToGram: "مظنه‌ای که دیده‌ام",
  gramToMazane: "نرخ گرم طلای ۱۸ عیار",
  amountMazane: "مظنه (تومان)",
  amountGram: "نرخ هر گرم طلای ۱۸ عیار (تومان)",
  resultGram: "نرخ هر گرم طلای ۱۸ عیار معادل آن (تومان)",
  resultMazane: "مظنه‌ی معادل آن (تومان)",
  divisor: "مثقال آب‌شده به مقیاس ۱۸ عیار",
  gram: "گرم",
  toman: "تومان",
} as const;

const OWN_NUMBER_NOTE =
  "عددی که وارد می‌کنید مال خودتان است. تابلو هیچ مظنه‌ای اعلام نمی‌کند و خروجی این صفحه هم نرخ بازار نیست، فقط همان عدد شما با واحد دیگری نوشته شده است.";

const CONVENTION_NOTE =
  "مبنای تبدیل: یک مثقال ۴٫۶۰۸۳ گرم و طلای آب‌شده عیار ۷۰۵. این دو عدد قرارداد بازار سنتی طلاست، نه رقمی که جایی تصویب شده باشد؛ اگر فروشنده‌ی شما با عیار دیگری حساب می‌کند، عدد این صفحه با فاکتور او یکی نمی‌شود.";

const EMPTY_NOTE = "عدد را وارد کنید تا معادلش نوشته شود.";

const SHARE_TITLE = "تبدیل مظنه و نرخ گرم";

export interface MazaneForm {
  initial: Record<string, string>;
  values: Record<string, string>;
  setValue(key: string, value: string): void;
  direction: MazaneDirection;
  amount: number | null;
  result: number | null;
}

function initialValues(): Record<string, string> {
  return { direction: "mazane-to-gram", amount: "" };
}

export function useMazaneForm(): MazaneForm {
  const [initial] = useState<Record<string, string>>(initialValues);
  const [values, setValues] = useState<Record<string, string>>(initial);

  const direction: MazaneDirection =
    values["direction"] === "gram-to-mazane" ? "gram-to-mazane" : "mazane-to-gram";
  const amount = parseCalculatorInput(values["amount"] ?? "");
  const result = amount === null ? null : convertMazane(direction, amount);

  useCalcEvents({
    tool: CALC_TOOL_MAZANE,
    initial,
    values,
    hasResult: result !== null,
  });

  return {
    initial,
    values,
    setValue: (key, value) => setValues((previous) => ({ ...previous, [key]: value })),
    direction,
    amount,
    result,
  };
}

export function MazaneInputs({ form }: { form: MazaneForm }) {
  const toGram = form.direction === "mazane-to-gram";

  return (
    <section data-card="calculator" className="card-surface px-5 py-4 sm:px-6">
      <div className="space-y-2.5">
        <label className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-[13px] focus-within:border-primary">
          <span className="shrink-0 text-tx3">{LABELS.direction}</span>
          <select
            name="direction"
            value={form.values["direction"] ?? "mazane-to-gram"}
            onChange={(event) => form.setValue("direction", event.target.value)}
            className="bg-transparent text-left outline-none"
          >
            <option value="mazane-to-gram">{LABELS.mazaneToGram}</option>
            <option value="gram-to-mazane">{LABELS.gramToMazane}</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-[13px] focus-within:border-primary">
          <span className="shrink-0 text-tx3">
            {toGram ? LABELS.amountMazane : LABELS.amountGram}
          </span>
          <input
            name="amount"
            inputMode="decimal"
            value={form.values["amount"] ?? ""}
            onChange={(event) => form.setValue("amount", event.target.value)}
            className="num w-32 bg-transparent text-left outline-none"
            dir="ltr"
          />
        </label>
      </div>

      <p data-calculator-own-number-note className="mt-3 text-[11px] leading-5 text-tx3">
        {OWN_NUMBER_NOTE}
      </p>

      <p data-calculator-convention-note className="mt-2 text-[11px] leading-5 text-tx3">
        {CONVENTION_NOTE}
      </p>
    </section>
  );
}

export function mazaneShareCard(form: MazaneForm): ShareCard | null {
  if (form.result === null || form.amount === null) return null;
  const toGram = form.direction === "mazane-to-gram";
  return {
    title: SHARE_TITLE,
    lines: [
      {
        label: toGram ? LABELS.amountMazane : LABELS.amountGram,
        value: formatFaNumber(form.amount),
      },
      {
        label: LABELS.divisor,
        value: `${formatFaNumber(MESGHAL_IN_18K_GRAMS, { maximumFractionDigits: 4 })} ${LABELS.gram}`,
      },
    ],
    total: {
      label: toGram ? LABELS.resultGram : LABELS.resultMazane,
      value: formatFaNumber(form.result),
    },
    note: null,
    pagePath: MAZANE_TOOL_PATH,
  };
}

export function MazaneResult({ form }: { form: MazaneForm }) {
  const toGram = form.direction === "mazane-to-gram";

  return (
    <section className="card-surface px-5 py-4 sm:px-6">
      {form.result !== null && (
        <dl
          data-calculator-breakdown
          className="rounded-[10px] border border-line2 px-3.5 py-2.5 text-[12.5px]"
        >
          <div className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-tx3">{LABELS.divisor}</dt>
            <dd data-breakdown-line="divisor" className="num">
              {`${formatFaNumber(MESGHAL_IN_18K_GRAMS, { maximumFractionDigits: 4 })} ${LABELS.gram}`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-tx3">{`مثقال (${LABELS.gram})`}</dt>
            <dd data-breakdown-line="mesghal" className="num">
              {formatFaNumber(MESGHAL_GRAMS, { maximumFractionDigits: 4 })}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-2.5 rounded-[10px] bg-acbg p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-actx">
            {toGram ? LABELS.resultGram : LABELS.resultMazane}
          </span>
          <span data-calculator-total className="num text-xl font-semibold text-actx">
            {form.result === null ? "—" : formatFaNumber(form.result)}
          </span>
        </div>
      </div>

      {form.result === null && (
        <p data-calculator-empty-note className="mt-2.5 text-[11px] leading-5 text-tx3">
          {EMPTY_NOTE}
        </p>
      )}

      {toGram && form.result !== null && (
        <p data-calculator-handoff className="mt-2.5 text-[11px] leading-5 text-tx3">
          حالا که نرخ گرم را دارید،{" "}
          <a href="/mohasebe-tala" className="transition-smooth text-primary hover:underline">
            اجرت و مالیات فاکتور طلای زینتی
          </a>{" "}
          را هم می‌شود روی همین عدد باز کرد.
        </p>
      )}

      <ShareResultButton card={mazaneShareCard(form)} />
    </section>
  );
}
