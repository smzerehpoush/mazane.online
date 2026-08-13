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
