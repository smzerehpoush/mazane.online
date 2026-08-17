import { useState } from "react";

import { CALC_TOOL_JEWELRY } from "@/lib/calc-events";
import {
  currentVatPercent,
  jewelryBreakdown,
  parseCalculatorInput,
  type JewelryBreakdown,
} from "@/lib/calculator";
import { formatFaNumber, formatFaPercentPoints } from "@/lib/fa-number";
import { useCalcEvents } from "@/lib/use-calc-events";

interface Field {
  key: string;
  label: string;
}

const FIELDS: readonly Field[] = [
  { key: "weight", label: "وزن (گرم)" },
  { key: "wage", label: "اجرت ساخت (٪)" },
  { key: "profit", label: "سود (٪)" },
  { key: "vat", label: "مالیات بر ارزش افزوده (٪)" },
];

type MoneyLine = "gold" | "wage" | "profit" | "vat";

const BREAKDOWN_LINES: readonly { key: MoneyLine; label: string }[] = [
  { key: "gold", label: "ارزش طلای خام" },
  { key: "wage", label: "اجرت ساخت" },
  { key: "profit", label: "سود فروشنده" },
  { key: "vat", label: "مالیات بر ارزش افزوده" },
];

const EXTRA_COST_LABEL = "هزینه‌ی اضافه نسبت به طلای خام";

const VAT_NOTE =
  "مالیات بر ارزش افزوده فقط روی اجرت و سود حساب می‌شود و اصل طلا معاف است: بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰. نرخ آن از سال ۱۴۰۴ ده درصد است؛ بند «خ» تبصره (۱) قانون بودجه.";

const PROFIT_NOTE =
  "برای سود فروشنده نرخ‌نامه‌ای اعلام نشده است؛ این عدد عرف بازار است و از فروشنده‌ای تا فروشنده‌ی دیگر فرق می‌کند. عدد فاکتور خودتان را وارد کنید.";

function initialValues(): Record<string, string> {
  return {
    weight: "",
    wage: "",
    profit: "",
    vat: formatFaNumber(currentVatPercent()),
  };
}

export function JewelryResult({ breakdown }: { breakdown: JewelryBreakdown | null }) {
  const extraCostPercent = breakdown?.extraCostPercent ?? null;

  return (
    <>
      {breakdown !== null && (
        <dl
          data-calculator-breakdown
          className="rounded-[10px] border border-line2 px-3.5 py-2.5 text-[12.5px]"
        >
          {BREAKDOWN_LINES.map((line) => (
            <div key={line.key} className="flex items-baseline justify-between gap-2 py-1">
              <dt className="text-tx3">{line.label}</dt>
              <dd data-breakdown-line={line.key} className="num">
                {formatFaNumber(breakdown[line.key])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="rounded-[10px] bg-acbg p-4">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-actx">مبلغ نهایی (تومان)</span>
          <span data-calculator-total className="num text-xl font-semibold text-actx">
            {breakdown === null ? "—" : formatFaNumber(breakdown.total)}
          </span>
        </div>

        {extraCostPercent !== null && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-actx/20 pt-2.5">
            <span className="text-[12px] text-actx">{EXTRA_COST_LABEL}</span>
            <span data-calculator-extra-cost className="num text-[15px] font-semibold text-actx">
              {formatFaPercentPoints(extraCostPercent, { maximumFractionDigits: 1 })}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function JewelryCalculator({
  pricePerGram,
  referenceName,
}: {
  pricePerGram: number | null;
  referenceName: string | null;
}) {
  const [initial] = useState<Record<string, string>>(initialValues);
  const [values, setValues] = useState<Record<string, string>>(initial);

  const weight = parseCalculatorInput(values["weight"] ?? "");
  const percent = (key: string): number => parseCalculatorInput(values[key] ?? "") ?? 0;

  const breakdown =
    weight === null || pricePerGram === null
      ? null
      : jewelryBreakdown({
          weightGrams: weight,
          pricePerGram,
          wagePercent: percent("wage"),
          profitPercent: percent("profit"),
          vatPercent: percent("vat"),
        });

  useCalcEvents({ tool: CALC_TOOL_JEWELRY, initial, values, hasResult: breakdown !== null });

  return (
    <section data-card="calculator" className="card-surface px-5 py-4 sm:px-6">
      <h2 className="text-[15.5px] font-semibold">ماشین حساب طلای زینتی</h2>

      <div className="mt-3.5 space-y-2.5">
        {FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex items-center justify-between gap-2 rounded-[10px] border border-line2 px-3.5 py-2.5 text-[13px] focus-within:border-primary"
          >
            <span className="shrink-0 text-tx3">{field.label}</span>
            <input
              inputMode="decimal"
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
              }
              className="num w-20 bg-transparent text-left outline-none"
              dir="ltr"
            />
          </label>
        ))}

        <JewelryResult breakdown={breakdown} />
      </div>

      {pricePerGram !== null && referenceName !== null && (
        <p className="mt-2.5 text-[11px] leading-5 text-tx3">
          بر پایه‌ی نرخ مرجع هر گرم طلای ۱۸ عیار در {referenceName}. اجرت روی قیمت طلا، سود روی
          مجموع طلا و اجرت، و مالیات روی اجرت و سود حساب می‌شود.
        </p>
      )}

      <p data-calculator-source className="mt-2 text-[11px] leading-5 text-tx3">
        {VAT_NOTE}
      </p>

      <p data-calculator-profit-note className="mt-2 text-[11px] leading-5 text-tx3">
        {PROFIT_NOTE}
      </p>
    </section>
  );
}
