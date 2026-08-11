/**
 * کارت‌های ستون کناری (بند ۸ سند طراحی).
 *
 * سه کارت اینجاست چون هر سه پوسته‌ی سروررندرند و هیچ‌کدام داده‌ی قیمت
 * نمی‌خوانند — یعنی هیچ‌کدام به لایه‌ی زنده وابسته نیستند.
 *
 * ⚠️ **حباب‌سنج عمداً غیرفعال است** (بند ۱۵، تصمیم ۴). دلیلش داده است نه
 * طراحی: ورودی فرمول (انس جهانی × دلار) در گردآورنده وجود ندارد — منبع
 * دلاری در ۲۰۲۶-۰۸-۱۰ حذف شد و هیچ آداپتری `XAU` تولید نمی‌کند
 * (`docs/api-gaps.md` بند ۳). هیچ عددی جعل نمی‌شود؛ خانه‌ها خالی‌اند و نوار
 * «به زودی» می‌گیرد. طرح کامل در سند طراحی دست‌نخورده ثبت است.
 */
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";

function ComingSoonBar() {
  return (
    <div className="mt-3 rounded-[10px] bg-ambg px-3 py-2.5 text-center text-[12.5px] text-am">
      به زودی فعال می‌شود
    </div>
  );
}

/** بند ۸ — سه خانه‌ی خالی، بدون هیچ عدد جعلی. */
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

/** بند ۸ — «هشدار قیمت»، فعلاً غیرفعال. */
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
