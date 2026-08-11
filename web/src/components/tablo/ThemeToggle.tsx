/**
 * دکمه‌ی تعویض تم روشن/تاریک (بند ۲ و بند ۴ سند طراحی).
 *
 * ⚠️ **آیکون با CSS عوض می‌شود، نه با state ری‌اکت.** این تصمیم اصلی این
 * فایل است: اگر آیکون از یک `useState` بیاید، سرور که همیشه `light` رندر
 * می‌کند ماه را می‌نویسد و کاربرِ تم‌تاریک تا لحظه‌ی hydration آیکون غلط
 * می‌بیند (و ری‌اکت هم واگرایی گزارش می‌کند). با واریانت `dark:` تیلویند —
 * که در `styles.css` به `[data-theme="dark"]` بسته شده — هر دو آیکون در
 * HTML اند و مرورگر همان لحظه‌ی نشستنِ صفت، درستی را نشان می‌دهد. یعنی
 * پیش از اجرای هر جاوااسکریپتی درست است.
 *
 * ⚠️ `aria-label` هم به همین دلیل **ثابت** است و کنش را توصیف می‌کند نه
 * وضعیت را: برچسبِ وضعیت‌محور («حالت تاریک») همان مشکل واگرایی را به لایه‌ی
 * دسترس‌پذیری می‌برد، جایی که CSS نمی‌تواند نجاتش دهد.
 *
 * تا وقتی کاربر دستی انتخاب نکرده، تغییر تم سیستم دنبال می‌شود؛ بعد از
 * اولین انتخاب، ترجیح او مقدم است و listener کنار می‌کشد (بند ۲).
 */
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

import { applyTheme, currentTheme, hasStoredPreference } from "@/lib/theme";

export function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange(event: MediaQueryListEvent): void {
      // انتخاب دستی کاربر همیشه مقدم است — بند ۲ سند طراحی.
      if (hasStoredPreference()) return;
      document.documentElement.setAttribute("data-theme", event.matches ? "dark" : "light");
    }
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  return (
    <button
      type="button"
      data-theme-toggle
      aria-label="تغییر حالت روشن و تاریک"
      onClick={() => applyTheme(currentTheme() === "dark" ? "light" : "dark")}
      className="transition-smooth grid size-9 shrink-0 place-items-center rounded-full border border-line2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
    >
      <Moon aria-hidden className="size-4 dark:hidden" />
      <Sun aria-hidden className="hidden size-4 dark:block" />
    </button>
  );
}
