/**
 * ⚠️ Why the script is a **string** and not an imported module: it must run
 * before anything else, so it can't wait for the bundle. It stays right
 * here next to its constants so the key name and attribute name don't
 * diverge between the two places.
 */

export const THEME_ATTRIBUTE = "data-theme";

export const THEME_STORAGE_KEY = "tablo:theme";

export type Theme = "light" | "dark";

export const SERVER_THEME: Theme = "light";

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persisting the preference failed; the theme itself has already been applied.
  }
}

export function hasStoredPreference(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light";
  } catch {
    return false;
  }
}
