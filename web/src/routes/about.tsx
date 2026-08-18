import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/structured-data";

const TITLE = "درباره تابلو — مقایسه شفاف قیمت طلا";
const DESCRIPTION =
  "تابلو قیمت اعلامی طلا و سکه را از چند منبع کنار هم می‌گذارد تا اختلاف قیمت‌ها، کارمزدها و تازگی داده‌ها شفاف‌تر دیده شود.";

const FAQ = [
  {
    question: "تابلو فروشنده طلاست؟",
    answer:
      "نه. تابلو معامله‌گر، فروشنده یا مشاور سرمایه‌گذاری نیست و فقط داده‌های قیمت را برای مقایسه و تصمیم‌گیری آگاهانه‌تر نمایش می‌دهد.",
  },
  {
    question: "تابلو چطور درآمد دارد؟",
    answer:
      "از لینک‌های معرفی. اگر از مسیر خروجی تابلو وارد سایت یک سکو شوید و آنجا ثبت‌نام یا خرید کنید، تابلو برای بخشی از سکوها کمیسیون می‌گیرد. کمیسیون در ترتیب نمایش اثری ندارد؛ مرتب‌سازی فقط بر پایه‌ی قیمت اعلامی و کارمزد همان سکو است و نرخ مرجع صفحه‌ی اصلی هم از tala.ir خوانده می‌شود که خودش سکو نیست.",
  },
  {
    question: "قیمت‌های تابلو هر چند وقت یک‌بار به‌روزرسانی می‌شود؟",
    answer:
      "قیمت‌ها در بازه‌های کوتاه به‌روزرسانی می‌شوند و کنار داده‌ها وضعیت تازگی یا کهنگی نمایش داده می‌شود تا کاربر بداند عدد مربوط به چه زمانی است.",
  },
  {
    question: "تابلو قیمت رسمی بازار را اعلام می‌کند؟",
    answer:
      "نه. هر عدد به منبع خودش مربوط است و تابلو آن‌ها را به‌عنوان نرخ قابل مقایسه نمایش می‌دهد، نه به‌عنوان نرخ رسمی یا توصیه خرید و فروش.",
  },
] as const;

export function aboutHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "درباره تابلو", url: `${SITE_URL}/about` },
        ]),
      },
      {
        type: "application/ld+json",
        children: faqPageJsonLd(FAQ),
      },
    ],
  };
}

export const Route = createFileRoute("/about")({
  head: () => aboutHead(),
  component: AboutPage,
});

export function AboutPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "درباره تابلو" }]} />

      <article className="glass-surface px-5 py-7 text-[15px] leading-8 text-foreground/90 sm:px-8 sm:py-9">
        <p className="text-[12px] font-medium tracking-[0.18em] text-gold">درباره تابلو</p>
        <h1 className="mt-3 text-[30px] leading-[1.35] font-black text-foreground sm:text-[40px]">
          تابلو برای مقایسه شفاف قیمت طلا ساخته شده است
        </h1>
        <p className="mt-5">
          بازار آنلاین طلا برای کاربر عادی همیشه یک عدد ساده نیست. قیمت اعلامی، کارمزد، وضعیت باز یا
          بسته بودن خرید و فروش، و زمان ثبت داده می‌تواند بین سکوهای مختلف فرق داشته باشد. تابلو این
          داده‌ها را کنار هم می‌گذارد تا کاربر قبل از تصمیم‌گیری، تصویر روشن‌تری از اختلاف قیمت‌ها
          داشته باشد.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["بی‌طرف", "تابلو قیمت‌ها را برای مقایسه نمایش می‌دهد و خودش طرف معامله نیست."],
            ["شفاف", "برای هر عدد، منبع و وضعیت تازگی داده تا حد امکان مشخص می‌شود."],
            ["متمرکز بر کاربر", "هدف صفحه‌ها پاسخ سریع به پرسش‌هایی مثل قیمت طلا و قیمت سکه است."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[20px] border border-border bg-surface p-4">
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-[13px] leading-7 text-foreground/78">{body}</p>
            </div>
          ))}
        </section>

        <h2 className="mt-9 text-lg font-semibold text-foreground">تابلو چه کاری انجام نمی‌دهد؟</h2>
        <p className="mt-3">
          تابلو نرخ رسمی، سیگنال خرید، سیگنال فروش یا تضمین سود ارائه نمی‌کند. عددها ابزار
          مقایسه‌اند و می‌توانند با تأخیر، خطای منبع یا تغییر سریع بازار همراه باشند. برای همین کنار
          بخش‌های مهم، وضعیت بروزرسانی و توضیح محدودیت‌ها نمایش داده می‌شود.
        </p>

        <h2 className="mt-9 text-lg font-semibold text-foreground">تابلو چطور درآمد دارد؟</h2>
        <p className="mt-3">
          لینک‌های خروجی تابلو همگی از یک مسیر واحد رد می‌شوند، مسیر{" "}
          <span dir="ltr">/go/</span>، و بعد به سایت خود سکو می‌رسند. برای بخشی از سکوها، اگر از
          همین مسیر وارد شوید و آنجا ثبت‌نام یا خرید کنید، تابلو کمیسیون دریافت می‌کند. درآمد سایت
          از همین‌جاست.
        </p>
        <p className="mt-3">
          کمیسیون در ترتیب نمایش سکوها اثری ندارد. جای هر سکو روی محور قیمت و ترتیب سطرهای مقایسه
          فقط از قیمت اعلامی و کارمزد همان سکو ساخته می‌شود. فیلدهای مربوط به لینک معرفی پیش از
          ساخته‌شدن صفحه حذف می‌شوند و اصلاً به لایه‌ی نمایش نمی‌رسند؛ یک تست خودکار در هر تغییر کد
          همین را بررسی می‌کند.
        </p>
        <p className="mt-3">
          نرخ مرجع صفحه‌ی اصلی از tala.ir خوانده می‌شود، نه از یکی از سکوها. این انتخاب عمدی است:
          سکویی که خودش در همان صفحه مقایسه می‌شود نمی‌تواند معیار سنجش بقیه باشد. نام منبع مرجع
          همیشه کنار عدد نوشته می‌شود.
        </p>

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
          <a href="/methodology" className="transition-smooth text-primary hover:underline">
            روش محاسبه و بروزرسانی قیمت‌ها
          </a>
        </p>
      </article>
    </PageShell>
  );
}
