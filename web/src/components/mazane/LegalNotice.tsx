/**
 * نوار هشدار ماده ۵ (بند ۷.۲ سند معماری) — روی هر صفحه‌ای که لینک ارجاع
 * (مسیر ‎/go/‎) دارد: صفحه‌ی اصلی، صفحات دارایی و صفحات سکو.
 *
 * متن، همان الزام دستورالعمل اجرایی خرید و فروش برخط طلا و نقره است:
 * «هم اعتبار می‌سازد و هم مسئولیت را منتقل می‌کند». جای ثابت (نوار پایانی)،
 * از نظر بصری متمایز، و در خودِ HTML سروررندر — نه تزریق کلاینتی.
 *
 * متن و صفت ‎data-legal-notice‎ عیناً از اپ قبلی منتقل شده‌اند تا نگهبان
 * تست‌ها با یک بازطراحی بی‌سروصدا از دست نرود.
 */
export const MADDE5_WARNING_FA =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

export function Madde5Bar() {
  return (
    <div
      data-legal-notice="madde-5"
      role="note"
      className="rounded-2xl border-t-[3px] px-4 py-3 text-[11px] leading-6"
      style={{
        borderTopColor: "color-mix(in oklab, var(--negative) 55%, transparent)",
        backgroundColor: "color-mix(in oklab, var(--negative-soft) 55%, var(--card))",
      }}
    >
      <p className="m-0">
        <strong>هشدار: </strong>
        {MADDE5_WARNING_FA}
      </p>
    </div>
  );
}
