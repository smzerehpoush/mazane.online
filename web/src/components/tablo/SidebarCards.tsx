/**
 * ⚠️ **The bubble gauge is intentionally disabled.** The reason is data,
 * not design: the formula's input (global ounce price × USD) doesn't
 * exist in the collector — the USD source was removed on 2026-08-10 and
 * no adapter produces `XAU`. No number is faked; the fields stay empty
 * and the bar shows "coming soon". The full design remains recorded,
 * untouched.
 */
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";

function ComingSoonBar() {
  return (
    <div className="mt-3 rounded-[10px] bg-ambg px-3 py-2.5 text-center text-[12.5px] text-am">
      به زودی فعال می‌شود
    </div>
  );
}

export function BubbleGauge() {
  return (
    <section data-card="bubble" className="card-surface px-5 py-4 sm:px-6">
      <h2 className="text-[15.5px] font-semibold">حباب سنج</h2>
      <div className="mt-3.5 grid grid-cols-3 gap-2.5" aria-hidden>
        {["قیمت ذاتی", "مقدار حباب", "درصد حباب"].map((label) => (
          <div key={label} className="rounded-[10px] bg-surface px-2 py-2.5 text-center">
            <span className="text-[11px] text-tx3">{label}</span>
            <b className="mt-0.5 block text-[14.5px] font-semibold text-muted-foreground/50">—</b>
          </div>
        ))}
      </div>
      <ComingSoonBar />
    </section>
  );
}

export function PriceAlertCard() {
  return (
    <section data-card="alert" className="card-surface px-5 py-4 sm:px-6">
      <h2 className="text-[15.5px] font-semibold">هشدار قیمت</h2>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        قیمت دلخواه خود را تنظیم کنید. هر زمان که نرخ طلا به آن رسید، به شما اطلاع می‌دهیم.
      </p>
      <ComingSoonBar />
    </section>
  );
}

export { JewelryCalculator };
