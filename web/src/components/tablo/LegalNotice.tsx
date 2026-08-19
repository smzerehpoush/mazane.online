export const MADDE5_WARNING_FA =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

export function Madde5Bar() {
  return (
    <div
      data-legal-notice="madde-5"
      role="note"
      className="rounded-2xl border-t-[3px] px-4 py-3 text-meta"
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
