import { useState } from "react";

import { currentVatPercent, jewelryTotal, parseCalculatorInput } from "@/lib/calculator";
import { formatFaNumber } from "@/lib/fa-number";

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

function initialValues(): Record<string, string> {
  return {
    weight: "",
    wage: "",
    profit: "",
    vat: formatFaNumber(currentVatPercent()),
  };
}

const VAT_NOTE =
  "مالیات بر ارزش افزوده فقط روی اجرت و سود حساب می‌شود و اصل طلا معاف است: بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰. نرخ آن از سال ۱۴۰۴ ده درصد است؛ بند «خ» تبصره (۱) قانون بودجه.";

export function JewelryCalculator({
  pricePerGram,
  referenceName,
}: {
  pricePerGram: number | null;
  referenceName: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const weight = parseCalculatorInput(values["weight"] ?? "");
  const percent = (key: string): number => parseCalculatorInput(values[key] ?? "") ?? 0;

  const total =
    weight === null || pricePerGram === null
      ? null
      : jewelryTotal({
          weightGrams: weight,
          pricePerGram,
          wagePercent: percent("wage"),
          profitPercent: percent("profit"),
          vatPercent: percent("vat"),
        });

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

        <div className="flex items-center justify-between rounded-[10px] bg-acbg p-4">
          <span className="text-[12.5px] text-actx">تومان</span>
          <span data-calculator-total className="num text-xl font-semibold text-actx">
            {total === null ? "—" : formatFaNumber(total)}
          </span>
        </div>
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
    </section>
  );
}
