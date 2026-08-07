/**
 * ماشین‌حساب دوحالته‌ی صفحه‌ی سکو (بلیت ۳۵) — زیر بخش «قیمت امروز»
 * (`PlatformPage.tsx::TermsSection`).
 *
 * **سکوی کارمزدمعلوم** (`!hasUnknownFee`): زبانه‌ی خرید/فروش، هرکدام دو
 * ورودی دوسویه‌ی وزن (گرم) و مبلغ (تومان) روی قیمت مؤثر همان سمت
 * (`effectiveBuyFor`/`effectiveSellFor` از `lib/rows.ts` — همان انتخاب
 * آماده‌ی گردآورنده که `TermsSection` هم استفاده می‌کند، نه محاسبه‌ی تازه).
 *
 * **سکوی کارمزد نامعلوم** (`hasUnknownFee`): بدون زبانه، فقط یک ورودی وزن
 * که مبلغ را با قیمت اسمی (`midPrice`) حساب می‌کند و برچسبش صریح می‌گوید
 * کارمزد در این عدد نیست — دقیقاً همان جمله‌ی `FeeSourceLabel` («سکو
 * کارمزدش را اعلام نکرده است») برای یکدستی واژگان.
 *
 * تبدیل وزن⟸مبلغ خودش تابع خالص `lib/calculator.ts` است (ضرب/تقسیم ساده
 * روی یک قیمت واحدِ آماده — قاعده‌ی ۱ قراردادها؛ اینجا فقط قیمت درست را
 * انتخاب و اثر جانبی state را مدیریت می‌کند).
 *
 * سوییچ زبانه عمداً ورودی‌های زبانه‌ی قبلی را ریست می‌کند (`key={activeSide}`
 * روی `TwoWaySide`) نه اینکه با useEffect دوباره محاسبه‌شان کند — ساده‌تر و
 * بدون حالت پنهان؛ کاربر با عوض‌کردن زبانه دارد آگاهانه معامله‌ی دیگری
 * می‌سنجد.
 *
 * قطع منبع (`row.snapshot === null`) یا نبودِ قیمت هر دو سمت ⟸ چیزی برای
 * حساب‌کردن نیست، کامپوننت `null` برمی‌گرداند (قاعده‌ی ۵: نه throw، نه کارت
 * خالی گمراه‌کننده) — صفحه همچنان با «قیمت در دسترس نیست» بالای همین بخش
 * صادق می‌ماند.
 *
 * دکمه‌ی «شروع معامله» دقیقاً همان الگوی لینک وب‌سایت بالای صفحه است:
 * ‎/go/<slug>‎ با ‎rel="sponsored nofollow noopener"‎ و ‎target="_blank"‎
 * (بند ۶.۴) — و فقط وقتی `hasOutbound` است، وگرنه دکمه‌ی مرده می‌ساخت.
 */
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { amountFromWeight, parseCalculatorInput, weightFromAmount } from "@/lib/calculator";
import { fa } from "@/lib/site-content";
import {
  effectiveBuyFor,
  effectiveSellFor,
  hasUnknownFee,
  isBuyOpen,
  isSellOpen,
  midPrice,
  type Row,
} from "@/lib/rows";

/** صفحه‌ی سکو فقط طلای ۱۸ عیار را نشان می‌دهد (همان قرارداد TermsSection/PlatformRateCard). */
const ASSET_INSTRUMENT = "GOLD_18K";

const UNKNOWN_FEE_NOTE = "بدون احتساب کارمزد — سکو کارمزدش را اعلام نکرده است.";

type TradeSide = "buy" | "sell";

const SIDE_LABEL: Record<TradeSide, string> = { buy: "خرید", sell: "فروش" };

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

function KnownFeeCalculator({ row, hasOutbound }: { row: Row; hasOutbound: boolean }) {
  const buyPrice = isBuyOpen(row) ? effectiveBuyFor(row, ASSET_INSTRUMENT) : null;
  const sellPrice = isSellOpen(row) ? effectiveSellFor(row, ASSET_INSTRUMENT) : null;
  const available: TradeSide[] = [
    ...(buyPrice !== null ? (["buy"] as const) : []),
    ...(sellPrice !== null ? (["sell"] as const) : []),
  ];

  const [side, setSide] = useState<TradeSide | null>(available[0] ?? null);
  const activeSide = side !== null && available.includes(side) ? side : (available[0] ?? null);

  // نه سمت خرید نه فروش هیچ عددی دارد ⟸ چیزی برای حساب‌کردن نیست.
  if (activeSide === null) return null;
  const unitPrice = activeSide === "buy" ? buyPrice : sellPrice;
  if (unitPrice === null) return null;

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
        {available.length < 2 ? null : (
          <div
            role="tablist"
            aria-label="خرید یا فروش"
            className="flex items-center gap-1 rounded-full bg-surface p-1"
          >
            {available.map((tradeSide) => (
              <button
                key={tradeSide}
                type="button"
                role="tab"
                aria-selected={activeSide === tradeSide}
                onClick={() => setSide(tradeSide)}
                className={`transition-smooth rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeSide === tradeSide
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {SIDE_LABEL[tradeSide]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* سوییچ زبانه ⟸ ورودی‌های زبانه‌ی قبلی ریست می‌شوند (بند بالای فایل). */}
      <TwoWaySide key={activeSide} unitPriceToman={unitPrice} />

      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">
        بر پایه‌ی قیمت مؤثر {SIDE_LABEL[activeSide]} همین سکو — کارمزد از قبل در این عدد لحاظ شده
        است.
      </p>

      <TradeButton
        slug={row.platform.slug}
        nameFa={row.platform.name_fa}
        hasOutbound={hasOutbound}
      />
    </section>
  );
}

function UnknownFeeCalculator({ row, hasOutbound }: { row: Row; hasOutbound: boolean }) {
  // هوک‌ها همیشه، بدون قید و شرط، پیش از هر return زودهنگام — قانون Hooks:
  // اگر midPrice بین دو رندر همین نمونه از عدد به null (یا برعکس) عوض شود،
  // ترتیب فراخوانی هوک نباید تغییر کند، وگرنه React کرش می‌کند.
  const [weightRaw, setWeightRaw] = useState("");
  const [amountRaw, setAmountRaw] = useState("");

  const midPriceValue = midPrice(row);
  if (midPriceValue === null) return null;
  // اسم تازه با نوع number خالص (نه number|null) — تا closure زیر هم بدون
  // نیاز به تنگ‌کردن دوباره‌ی جریان کنترل همین نوع را ببیند.
  const price: number = midPriceValue;

  function onWeightChange(next: string): void {
    setWeightRaw(next);
    const weight = parseCalculatorInput(next);
    setAmountRaw(weight === null ? "" : fa(amountFromWeight(weight, price)));
  }

  return (
    <section
      aria-labelledby="calculator-heading"
      data-platform-calculator
      className="glass-surface mt-6 px-5 py-5 sm:px-6"
    >
      <h2 id="calculator-heading" className="text-base font-semibold sm:text-lg">
        ماشین‌حساب معامله
      </h2>
      <p className="mt-1 text-[12px] leading-6 text-muted-foreground">{UNKNOWN_FEE_NOTE}</p>

      <div className="mt-4 max-w-xs">
        <NumberField
          label="وزن"
          unit="گرم"
          placeholder="مثلاً ۱"
          value={weightRaw}
          onChange={onWeightChange}
          kind="weight"
        />
      </div>

      <p className="mt-3 text-sm">
        <span data-calc-amount className="font-semibold tabular-nums">
          {amountRaw === "" ? "—" : `${amountRaw} تومان`}
        </span>
      </p>

      <TradeButton
        slug={row.platform.slug}
        nameFa={row.platform.name_fa}
        hasOutbound={hasOutbound}
      />
    </section>
  );
}

export function PlatformCalculator({ row, hasOutbound }: { row: Row; hasOutbound: boolean }) {
  if (row.snapshot === null) return null;
  return hasUnknownFee(row) ? (
    <UnknownFeeCalculator row={row} hasOutbound={hasOutbound} />
  ) : (
    <KnownFeeCalculator row={row} hasOutbound={hasOutbound} />
  );
}
