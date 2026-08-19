import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/structured-data";

const TITLE = "روش محاسبه قیمت طلا و سکه در تابلو";
const DESCRIPTION =
  "روش بروزرسانی، نمایش و مقایسه قیمت طلا و سکه در تابلو؛ شامل قیمت منبع، کارمزد، تازگی داده و محدودیت‌های استفاده از اعداد.";

const FAQ = [
  {
    question: "قیمت‌ها در تابلو چطور مقایسه می‌شوند؟",
    answer:
      "تابلو هر قیمت را به همان منبع خودش نسبت می‌دهد و در صفحه‌های مقایسه، قیمت‌ها را کنار وضعیت کارمزد و زمان ثبت داده نمایش می‌دهد تا اختلاف بین منابع واضح‌تر شود.",
  },
  {
    question: "اگر یک منبع داده ندهد چه اتفاقی می‌افتد؟",
    answer:
      "در صورت نبودن داده تازه، سایت باید به‌جای خطای صفحه، وضعیت ناموجود یا کهنه را نمایش دهد تا کاربر عدد قدیمی را با قیمت قطعی اشتباه نگیرد.",
  },
  {
    question: "آیا قیمت نمایش‌داده‌شده هزینه نهایی خرید است؟",
    answer:
      "نه همیشه. در برخی بازارها کارمزد، مدل سفارش، باز یا بسته بودن خرید و فروش و شرایط تسویه می‌تواند هزینه نهایی را تغییر دهد؛ بنابراین تابلو تا جای ممکن این زمینه‌ها را کنار قیمت نشان می‌دهد.",
  },
] as const;

export function methodologyHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/methodology` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "روش محاسبه قیمت‌ها", url: `${SITE_URL}/methodology` },
        ]),
      },
      {
        type: "application/ld+json",
        children: faqPageJsonLd(FAQ),
      },
    ],
  };
}

export const Route = createFileRoute("/methodology")({
  head: () => methodologyHead(),
  component: MethodologyPage,
});

export function MethodologyPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "روش محاسبه قیمت‌ها" }]} />

      <article className="card-surface px-5 py-7 text-[15px] leading-8 text-foreground/90 sm:px-8 sm:py-9">
        <p className="text-[12px] font-medium tracking-[0.18em] text-gold">شفافیت داده</p>
        <h1 className="mt-3 text-[30px] leading-[1.35] font-black text-foreground sm:text-[40px]">
          روش محاسبه قیمت طلا و سکه در تابلو
        </h1>
        <p className="mt-5">
          تابلو تلاش می‌کند قیمت‌ها را طوری نمایش دهد که کاربر فقط یک عدد نبیند؛ بلکه منبع عدد، زمان
          بروزرسانی، باز یا بسته بودن خرید و فروش، و اثر کارمزد را هم کنار آن ببیند. این صفحه توضیح
          می‌دهد اعداد چطور خوانده شوند و چه محدودیت‌هایی دارند.
        </p>

        <section className="mt-8 space-y-5">
          <div className="rounded-[22px] border border-border bg-surface p-5">
            <h2 className="text-lg font-bold text-foreground">قیمت منبع</h2>
            <p className="mt-2 text-[14px] leading-8 text-foreground/80">
              قیمت منبع همان عددی است که یک منبع مشخص برای دارایی مشخص اعلام کرده است. تابلو این عدد
              را با نام همان منبع نگه می‌دارد و آن را به میانگین یا نرخ رسمی تبدیل نمی‌کند.
            </p>
          </div>
          <div className="rounded-[22px] border border-border bg-surface p-5">
            <h2 className="text-lg font-bold text-foreground">کارمزد و قیمت قابل مقایسه</h2>
            <p className="mt-2 text-[14px] leading-8 text-foreground/80">
              در بازارهایی که کارمزد اعلام شده باشد، کاربر باید قیمت و کارمزد را با هم ببیند. اگر
              کارمزد منبعی نامشخص باشد، تابلو نباید آن را صفر فرض کند؛ چون این کار هزینه واقعی را
              کمتر از واقعیت نشان می‌دهد.
            </p>
          </div>
          <div className="rounded-[22px] border border-border bg-surface p-5">
            <h2 className="text-lg font-bold text-foreground">تازگی داده</h2>
            <p className="mt-2 text-[14px] leading-8 text-foreground/80">
              بازار طلا سریع تغییر می‌کند. برای همین عدد بدون زمان بروزرسانی کافی نیست. اگر داده
              تازه نباشد، تجربه درست این است که وضعیت کهنگی یا نبود داده مشخص شود، نه اینکه صفحه خطا
              بدهد یا عدد قدیمی را قطعی نشان دهد.
            </p>
          </div>
        </section>

        <h2 className="mt-9 text-lg font-semibold text-foreground">پرسش‌های پرتکرار</h2>
        <div className="mt-4 space-y-4">
          {FAQ.map((item) => (
            <section
              key={item.question}
              className="rounded-[18px] border border-border bg-surface p-4"
            >
              <h3 className="font-semibold text-foreground">{item.question}</h3>
              <p className="mt-2 text-[13px] leading-7 text-foreground/78">{item.answer}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-[12px]">
          <a href="/about" className="transition-smooth text-primary hover:underline">
            درباره تابلو
          </a>
        </p>
      </article>
    </PageShell>
  );
}
