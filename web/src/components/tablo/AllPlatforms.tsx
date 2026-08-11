/**
 * فهرست همه‌ی سکوها در پاصفحه (بند ۳ سند طراحی، تصمیم مالک ۲۰۲۶-۰۸-۱۱).
 *
 * ⚠️ دلیلش سئوست، نه طراحی. صفحه‌ی اصلی فقط ۲ تا ۶ منبع انتخابیِ پنل را نشان
 * می‌دهد (بند ۱۵، تصمیم ۲)؛ پیش از بازطراحی، جدول مقایسه به **هر ۱۳ سکو** یک
 * لینک داخلی درجه‌یک می‌داد. بدون این فهرست، صفحات آن سکوها تنها لینک
 * ورودی‌شان از صفحه‌ی اصلی را از دست می‌دادند و عمقشان از ۱ به ۲ می‌رفت.
 *
 * ⚠️ عمداً **بدون قیمت و بدون کارمزد**: این یک جدول مقایسه‌ی دوم نیست (بند ۱.۱
 * جدول را ممنوع کرده). فقط نام و لینک داخلی.
 *
 * لینک‌ها داخلی‌اند (‎/<slug>‎ — صفحه‌ی خود سکو روی دامنه‌ی ما)، پس `rel`
 * درآمدزا نمی‌گیرند؛ آن قاعده برای لینک **خروجی** است.
 */
import type { Row } from "@/lib/rows";

export function AllPlatforms({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <nav aria-labelledby="all-platforms-heading" className="mt-8">
      <h2 id="all-platforms-heading" className="text-xs font-semibold text-muted-foreground">
        همه‌ی سکوها
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {rows.map((row) => (
          <li key={row.platform.slug}>
            <a
              href={`/${row.platform.slug}`}
              data-all-platform={row.platform.slug}
              className="transition-smooth text-[11.5px] text-tx3 hover:text-primary"
            >
              {row.platform.name_fa}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
