import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { amountFromWeight, parseCalculatorInput, weightFromAmount } from "@/lib/calculator";
import { fa } from "@/lib/site-content";
import { priceToman, type Row } from "@/lib/rows";

const ASSET_INSTRUMENT = "GOLD_18K";

const PRICE_NOTE =
  "بر پایه‌ی قیمت اعلامی همین سکو، بدون احتساب کارمزد — کارمزد خرید و فروش بالاتر جداگانه آمده است.";

function TradeButton({
  slug,
  nameFa,
  hasOutbound,
}: {
  slug: string;
  nameFa: string;
  hasOutbound: boolean;
}) {
  if (!hasOutbound) return null;
  return (
    <a
      href={`/go/${slug}`}
      rel="sponsored nofollow noopener"
      target="_blank"
      data-outbound="calculator"
      className="transition-smooth mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
    >
      شروع معامله در {nameFa}
    </a>
  );
}

function NumberField({
  label,
  unit,
  value,
  placeholder,
  onChange,
  kind,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  kind: "weight" | "amount";
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      <span className="relative">
        <Input
          data-calc-weight={kind === "weight" ? true : undefined}
          data-calc-amount={kind === "amount" ? true : undefined}
          type="text"
          inputMode="decimal"
          dir="ltr"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pe-10 text-end tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[11px] text-muted-foreground">
          {unit}
        </span>
      </span>
    </label>
  );
}

function CalculatorSection({
  headerExtra,
  row,
  hasOutbound,
  children,
}: {
  headerExtra?: ReactNode;
  row: Row;
  hasOutbound: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="calculator-heading"
      data-platform-calculator
      className="glass-surface mt-6 px-5 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="calculator-heading" className="text-base font-semibold sm:text-lg">
          ماشین‌حساب معامله
        </h2>
        {headerExtra}
      </div>

      {children}

      <TradeButton
        slug={row.platform.slug}
        nameFa={row.platform.name_fa}
        hasOutbound={hasOutbound}
      />
    </section>
  );
}

function TwoWaySide({ unitPriceToman }: { unitPriceToman: number }) {
  const [weightRaw, setWeightRaw] = useState("");
  const [amountRaw, setAmountRaw] = useState("");

  function onWeightChange(next: string): void {
    setWeightRaw(next);
    const weight = parseCalculatorInput(next);
    setAmountRaw(weight === null ? "" : fa(amountFromWeight(weight, unitPriceToman)));
  }

  function onAmountChange(next: string): void {
    setAmountRaw(next);
    const amount = parseCalculatorInput(next);
    const weight = amount === null ? null : weightFromAmount(amount, unitPriceToman);
    setWeightRaw(weight === null ? "" : fa(weight));
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <NumberField
        label="وزن"
        unit="گرم"
        placeholder="مثلاً ۱"
        value={weightRaw}
        onChange={onWeightChange}
        kind="weight"
      />
      <NumberField
        label="مبلغ"
        unit="تومان"
        placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰"
        value={amountRaw}
        onChange={onAmountChange}
        kind="amount"
      />
    </div>
  );
}

function PriceCalculator({ row, hasOutbound }: { row: Row; hasOutbound: boolean }) {
  const price = priceToman(row, ASSET_INSTRUMENT);
  if (price === null) return null;

  return (
    <CalculatorSection row={row} hasOutbound={hasOutbound}>
      <TwoWaySide unitPriceToman={price} />

      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">{PRICE_NOTE}</p>
    </CalculatorSection>
  );
}

export function PlatformCalculator({ row, hasOutbound }: { row: Row; hasOutbound: boolean }) {
  if (row.snapshot === null) return null;
  return <PriceCalculator row={row} hasOutbound={hasOutbound} />;
}
