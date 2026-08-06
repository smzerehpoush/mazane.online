/**
 * نمایش فارسی — فقط قالب‌بندی، بدون هیچ محاسبه‌ی قیمتی.
 * ارقام نمایش با `Intl.NumberFormat('fa-IR')` (قراردادها، بخش استک).
 */

const tomanFormatter = new Intl.NumberFormat("fa-IR");

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

export function formatToman(priceToman: number): string {
  return tomanFormatter.format(priceToman);
}

export function formatDateTimeFa(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
