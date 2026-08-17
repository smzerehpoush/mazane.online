import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

import { applyTheme, currentTheme, hasStoredPreference } from "@/lib/theme";

export function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemChange(event: MediaQueryListEvent): void {
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
      className="transition-smooth grid size-11 shrink-0 place-items-center rounded-full border border-line2 text-muted-foreground hover:bg-surface-2 hover:text-foreground sm:size-9"
    >
      <Moon aria-hidden className="size-4 dark:hidden" />
      <Sun aria-hidden className="hidden size-4 dark:block" />
    </button>
  );
}
