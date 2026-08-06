/**
 * نوار هشدار ماده ۵ (بند ۷.۲ سند معماری) — روی هر صفحه‌ای که لینک ارجاع
 * (مسیر ‎/go/‎) دارد: صفحه‌ی اصلی، صفحات دارایی و صفحات سکو.
 *
 * متن، همان الزام دستورالعمل اجرایی خرید و فروش برخط طلا و نقره است:
 * «هم اعتبار می‌سازد و هم مسئولیت را منتقل می‌کند». جای ثابت (نوار پایانی)،
 * از نظر بصری متمایز، و در خود HTML سروررندر — نه تزریق کلاینتی.
 */
import type { CSSProperties } from "react";

export const MADDE5_WARNING_FA =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

const barStyle: CSSProperties = {
  marginTop: "24px",
  padding: "10px 16px",
  borderTop: "3px solid #b45309",
  borderRadius: "0 0 8px 8px",
  background: "#fff7ed",
  color: "#7c2d12",
  fontSize: "0.9em",
};

export function Madde5Bar() {
  return (
    <footer data-legal-notice="madde-5" role="note" style={barStyle}>
      <p style={{ margin: 0 }}>
        <strong>هشدار: </strong>
        {MADDE5_WARNING_FA}
      </p>
    </footer>
  );
}
