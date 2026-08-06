/**
 * نوار هشدار ماده ۵ (بند ۷.۲ سند معماری) — روی هر صفحه‌ای که لینک ارجاع
 * (مسیر ‎/go/‎) دارد: صفحه‌ی اصلی، صفحات دارایی و صفحات سکو.
 *
 * متن، همان الزام دستورالعمل اجرایی خرید و فروش برخط طلا و نقره است. جای
 * ثابت (نوار پایانی)، از نظر بصری متمایز، و در خود HTML سروررندر — نه تزریق
 * کلاینتی. منتقل‌شده از ‎app/legal-notice.tsx‎ اپ نکست قبلی، با همان متن و
 * همان قلاب ‎data-legal-notice‎.
 */
export const MADDE5_WARNING_FA =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

export function Madde5Bar() {
  return (
    <footer
      data-legal-notice="madde-5"
      role="note"
      className="mt-8 rounded-2xl border border-gold/40 bg-gold-soft/40 px-4 py-3 text-[12px] leading-6 text-foreground/80"
    >
      <p>
        <strong className="font-semibold">هشدار: </strong>
        {MADDE5_WARNING_FA}
      </p>
    </footer>
  );
}
