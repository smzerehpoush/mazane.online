/**
 * ماشین‌حساب صفحه‌ی سکو (بلیت ۳۵) — زیر بخش «قیمت امروز»
 * (`PlatformPage.tsx::TermsSection`).
 *
 * **یک حالت برای همه‌ی سکوها** (سند تصمیم ۰۰۰۲): دو ورودی دوسویه‌ی وزن
 * (گرم) و مبلغ (تومان) روی «قیمت» همان سکو — همان عدد آماده‌ی گردآورنده که
 * `TermsSection` هم نشان می‌دهد، نه محاسبه‌ی تازه.
 *
 * پیش‌تر دو حالت داشت: زبانه‌ی خرید/فروش روی دو قیمت مؤثر برای
 * کارمزدمعلوم‌ها، و یک ورودی ساده برای کارمزدنامعلوم‌ها. با حذف قیمت مؤثر
 * هر دو حالت به یکی رسیدند و زبانه بی‌موضوع شد — یک عدد بیشتر وجود ندارد.
 *
 * ⚠️ برچسب صریح می‌گوید کارمزد در این عدد **نیست**: ماشین‌حسابی که عدد
 * پیش-از-کارمزد بدهد و این را نگوید، از نبودنش بدتر است.
 *
 * تبدیل وزن⟸مبلغ خودش تابع خالص `lib/calculator.ts` است (ضرب/تقسیم ساده
 * روی یک قیمت واحدِ آماده — قاعده‌ی ۱ قراردادها؛ اینجا فقط قیمت درست را
 * انتخاب و اثر جانبی state را مدیریت می‌کند).
 *
 * قطع منبع (`row.snapshot === null`) یا نبودِ قیمت ⟸ چیزی برای حساب‌کردن
 * نیست، کامپوننت `null` برمی‌گرداند (قاعده‌ی ۵: نه throw، نه کارت خالی
 * گمراه‌کننده) — صفحه همچنان با «قیمت در دسترس نیست» بالای همین بخش صادق
 * می‌ماند.
 *
 * دکمه‌ی «شروع معامله» دقیقاً همان الگوی لینک وب‌سایت بالای صفحه است:
 * ‎/go/<slug>‎ با ‎rel="sponsored nofollow noopener"‎ و ‎target="_blank"‎
 * (بند ۶.۴) — و فقط وقتی `hasOutbound` است، وگرنه دکمه‌ی مرده می‌ساخت.
 */
import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { amountFromWeight, parseCalculatorInput, weightFromAmount } from "@/lib/calculator";
import { fa } from "@/lib/site-content";
import { priceToman, type Row } from "@/lib/rows";

/** صفحه‌ی سکو فقط طلای ۱۸ عیار را نشان می‌دهد (همان قرارداد TermsSection/PlatformRateCard). */
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

/**
 * یک فیلد عددی با واحد شناور در انتهای ورودی — رشته‌ی خام کاربر، بدون هیچ
 * گرد/پارس تا اینجا. قلاب `data-calc-weight`/`data-calc-amount` مثل الگوی
 * `PriceCard::side` در `PlatformPage.tsx` با ترنری روی نام ثابت است، نه
 * کلید پویا — سازگار با قاعده‌ی نام‌گذاری ‎data-*‎ در JSX.
 */
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

/**
 * پوسته‌ی مشترک دو حالت (خرید/فروش دوسویه، فقط وزن) — یک `section` با تیتر
 * ثابت و دکمه‌ی «شروع معامله» در انتها؛ فقط تفاوت بین دو حالت (زبانه‌های
 * خرید/فروش کنار تیتر، و بدنه‌ی ورودی‌ها) از بیرون تزریق می‌شود.
 */
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

/**
 * دو ورودی دوسویه‌ی یک سمت (خرید یا فروش): وزن به گرم، مبلغ به تومان — روی
 * یک قیمت واحدِ ثابت (`unitPriceToman`). هرکدام تایپ شود آن‌یکی از تابع
 * خالص `lib/calculator.ts` دوباره حساب می‌شود؛ ورودی نامعتبر/خالی فیلد
 * مقابل را هم خالی می‌کند، نه صفر یا NaN.
 */
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
