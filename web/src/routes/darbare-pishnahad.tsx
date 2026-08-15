/**
 * ⚠️ This is editorial text, carried over verbatim from ‎app/darbare-pishnahad/page.tsx‎
 * of the previous Next app; do not rewrite.
 */
import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";

const TITLE = "معیارهای پیشنهاد سردبیر — تابلو";
const DESCRIPTION =
  "پیشنهاد سردبیر تابلو چگونه انتخاب می‌شود؟ معیار علنی: کمترین هزینه‌ی رفت‌وبرگشت میان سکوهایی با کارمزد اعلام‌شده در API و خرید و فروش باز.";

export function darbarePishnahadHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/darbare-pishnahad` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          {
            name: "معیارهای پیشنهاد سردبیر",
            url: `${SITE_URL}/darbare-pishnahad`,
          },
        ]),
      },
    ],
  };
}

export const Route = createFileRoute("/darbare-pishnahad")({
  head: () => darbarePishnahadHead(),
  component: DarbarePishnahad,
});

export function DarbarePishnahad() {
  return (
    <PageShell>
      <Breadcrumbs
        items={[{ label: "خانه", href: "/" }, { label: "معیارهای پیشنهاد سردبیر" }]}
      />

      <article className="glass-surface px-5 py-7 text-[15px] leading-8 text-foreground/90 sm:px-8 sm:py-9">
        <h1 className="text-xl leading-9 font-bold text-foreground sm:text-2xl">
          پیشنهاد سردبیر چگونه انتخاب می‌شود؟
        </h1>

        <p className="mt-5">
          معیار یک جمله است:{" "}
          <strong className="font-semibold text-foreground">
            کمترین هزینه‌ی رفت‌وبرگشت
          </strong>{" "}
          میان سکوهایی که کارمزدشان مستقیم از API خودشان می‌آید و در همین لحظه، هم خرید و
          هم فروششان باز است. انتخاب کاملاً خودکار از روی همین داده‌های جدول انجام می‌شود
          — هیچ دست و سلیقه‌ای در کار نیست.
        </p>

        <h2 className="mt-9 text-lg font-semibold text-foreground">چرا این سه شرط؟</h2>
        <ul className="mt-3 list-disc space-y-3 pr-6">
          <li>
            <strong className="font-semibold text-foreground">
              هزینه‌ی رفت‌وبرگشت
            </strong>{" "}
            یعنی اگر همین حالا بخرید و بفروشید چند درصد از پولتان صرف کارمزد می‌شود —
            صادقانه‌ترین عدد برای مقایسه‌ی سکوها، چون هم کارمزد خرید را می‌بیند و هم
            کارمزد فروش.
          </li>
          <li>
            <strong className="font-semibold text-foreground">
              فقط کارمزد اعلام‌شده در API:
            </strong>{" "}
            کارمزدی که سکو خودش به صورت ماشینی اعلام می‌کند خودکار به‌روز می‌ماند. کارمزد
            دستی (خوانده از صفحه‌ی وب) یا نامشخص ممکن است از واقعیت عقب باشد؛ روی چنین
            عددی پیشنهاد نمی‌سازیم.
          </li>
          <li>
            <strong className="font-semibold text-foreground">
              خرید و فروش هر دو باز:
            </strong>{" "}
            سکویی که یک سمت معامله‌اش بسته است، هر قدر هم ارزان، الان قابل استفاده‌ی کامل
            نیست.
          </li>
        </ul>

        <h2 className="mt-9 text-lg font-semibold text-foreground">
          تفکیک تبلیغ و تحریریه
        </h2>
        <p className="mt-3">
          پیشنهاد سردبیر تحریریه است و{" "}
          <strong className="font-semibold text-foreground">هرگز فروخته نمی‌شود</strong>.
          اگر روزی جایگاهش به تبلیغ پولی داده شود، همان‌جا برچسب صریح «تبلیغ» می‌خورد، از
          نظر بصری جدا می‌ماند و مثل همیشه هیچ اثری بر ترتیب جدول نخواهد داشت — ترتیب
          جدول فقط از قیمت مؤثر می‌آید، نه از هیچ قراردادی.
        </p>

        <p className="mt-8 text-[12px]">
          <a href="/" className="transition-smooth text-primary hover:underline">
            بازگشت به جدول مقایسه
          </a>
        </p>
      </article>
    </PageShell>
  );
}
