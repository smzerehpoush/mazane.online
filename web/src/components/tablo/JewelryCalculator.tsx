/**
 * ماشین‌حساب طلای زینتی (بند ۸ سند طراحی).
 *
 * چهار فیلد: وزن، اجرت ساخت، سود، مالیات بر ارزش افزوده. سلکتور عیار ندارد —
 * مبنا همیشه قیمت گرم طلای ۱۸ عیارِ **سکوی مرجع** است و نامش زیر خروجی
 * می‌آید (قاعده‌ی سخت ۴: هر عدد نام صاحبش را دارد).
 *
 * ⚠️ **این «فرمول قیمت» به معنای قاعده‌ی سخت ۱ نیست.** قاعده‌ی ۱ می‌گوید وب
 * نباید قیمت **سکو** را بسازد یا مشتق کند؛ اینجا هیچ قیمتی ساخته نمی‌شود.
 * ورودی‌ها را خودِ کاربر می‌زند و خروجی هرگز ذخیره، منتشر یا به سکویی منتسب
 * نمی‌شود — یک ابزار حساب برای کاربر است، مثل ماشین‌حساب جیبی. فرمولش هم
 * همان چیزی است که سند طراحی نوشته و در پاورقی کارت برای کاربر باز شده.
 *
 * ⚠️ پوسته سروررندر است (بند ۱۴) و فقط محاسبه بعد از تعامل کاربر انجام
 * می‌شود. با جاوااسکریپت خاموش، فیلدها دیده می‌شوند و خروجی «—» می‌ماند.
 */
import { useState } from "react";

import { parseCalculatorInput } from "@/lib/calculator";
import { formatFaNumber } from "@/lib/fa-number";

interface Field {
  key: string;
  label: string;
  /** پیش‌فرض بازار برای درصدها؛ وزن عمداً خالی است تا کاربر خودش بزند. */
  initial: string;
}

const FIELDS: readonly Field[] = [
  { key: "weight", label: "وزن (گرم)", initial: "" },
  { key: "wage", label: "اجرت ساخت (٪)", initial: "" },
  { key: "profit", label: "سود (٪)", initial: "" },
  { key: "vat", label: "مالیات بر ارزش افزوده (٪)", initial: "" },
];

/**
 * مبلغ نهایی طلای زینتی از روی قیمت گرم.
 *
 * `وزن × قیمت × (۱ + اجرت) × (۱ + سود) × (۱ + مالیات)` — همان ترتیب مرسوم
 * بازار: اجرت روی قیمت طلا، سود روی مجموع طلا و اجرت، و مالیات روی کل.
 * درصدِ نداده‌شده صفر فرض می‌شود، نه اینکه محاسبه را متوقف کند.
 */
export function jewelryTotal(options: {
  weightGrams: number;
  pricePerGram: number;
  wagePercent: number;
  profitPercent: number;
  vatPercent: number;
}): number {
  const { weightGrams, pricePerGram, wagePercent, profitPercent, vatPercent } = options;
  const gold = weightGrams * pricePerGram;
  const withWage = gold * (1 + wagePercent / 100);
  const withProfit = withWage * (1 + profitPercent / 100);
  return Math.round(withProfit * (1 + vatPercent / 100));
}

export function JewelryCalculator({
  pricePerGram,
  referenceName,
}: {
  /** قیمت گرم سکوی مرجع؛ `null` یعنی امروز عددی نداریم. */
  pricePerGram: number | null;
  referenceName: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, field.initial])),
  );

  const weight = parseCalculatorInput(values["weight"] ?? "");
  // درصد خالی = صفر (نه «نامعتبر»): کاربری که فقط وزن را زده، باید قیمت خام
  // طلا را ببیند، نه خط تیره.
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
          بر پایه‌ی قیمت هر گرم طلای ۱۸ عیار در {referenceName}. اجرت روی قیمت طلا، سود روی مجموع
          طلا و اجرت، و مالیات روی کل حساب می‌شود.
        </p>
      )}
    </section>
  );
}
