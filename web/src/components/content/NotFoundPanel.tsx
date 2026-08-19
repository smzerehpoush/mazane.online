export function NotFoundPanel({
  title = "صفحه پیدا نشد",
  note = "نشانی‌ای که خواستید وجود ندارد، منتشر نشده یا پس گرفته شده است.",
}: {
  title?: string;
  note?: string;
}) {
  return (
    <>
      <div className="card-surface px-6 py-14 text-center">
        <p className="text-5xl font-bold text-foreground/80">۴۰۴</p>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{note}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a
            href="/"
            className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            جدول مقایسه‌ی قیمت‌ها
          </a>
          <a
            href="/blog"
            className="transition-smooth inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-surface"
          >
            بلاگ
          </a>
        </div>
      </div>
    </>
  );
}
