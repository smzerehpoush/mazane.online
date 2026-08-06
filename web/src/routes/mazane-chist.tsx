/**
 * صفحه‌ی «مظنه چیست» — ‎/mazane-chist‎ (بلیت ۱۰؛ بند ۱۱ + بند ۱۳، تصمیم ۱).
 *
 * هدف‌گیری هر دو املا: «مظنه» املای درست (ریشه‌ی عربی مَظِنّة) و «مضنه» غلط
 * املایی رایجی که تقاضای جست‌وجوی مستقل خودش را دارد. «مضنه» فقط در محتوا
 * هدف‌گیری می‌شود، هرگز در خود برند.
 *
 * صفحه ایستا و بی‌استور است؛ اسلاگ لاتین تخت (تصمیم ۱۱) که در `lib/slugs.ts`
 * به‌عنوان صفحه‌ی ایستا رزرو شده — مسیر ایستای روتر خودش بر ‎$slug‎ مقدم است و
 * حل‌کننده هم جدا ردش می‌کند (دفاع در عمق).
 *
 * قید بند ۷.۱ اینجا هم برقرار است: صفحه فقط «مفهوم» را توضیح می‌دهد و هیچ عدد
 * یا نرخ مظنه‌ای اعلام نمی‌کند — عدد فقط در جدول، منتسب به سکوی خودش.
 *
 * ⚠️ متن تحریریه است و منتقل‌شده‌ی عین‌به‌عین از ‎app/mazane-chist/page.tsx‎ اپ
 * نکست قبلی؛ بازنویسی نشود.
 */
import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";

const TITLE = "مظنه چیست؟ مظنه یا مضنه؟ — مظنه آنلاین";
const DESCRIPTION =
  "مظنه در بازار طلا یعنی قیمت یک مثقال طلای آب‌شده — مبنای قیمت‌گذاری طلا در بازار ایران. املای درست «مظنه» است و «مضنه» غلط املایی رایج همان واژه.";

/**
 * سرصفحه — جدا و صادرشده تا مرز تست وب بدون بستر روتر بسنجدش (همان رسم
 * `components/content/BlogViews.tsx`).
 */
export function mazaneChistHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/mazane-chist` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "مظنه چیست", url: `${SITE_URL}/mazane-chist` },
        ]),
      },
    ],
  };
}

export const Route = createFileRoute("/mazane-chist")({
  head: () => mazaneChistHead(),
  component: MazaneChist,
});

export function MazaneChist() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "مظنه چیست" }]} />

      <article className="glass-surface px-5 py-7 text-[15px] leading-8 text-foreground/90 sm:px-8 sm:py-9">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">مظنه چیست؟</h1>

        <p className="mt-5">
          <strong className="font-semibold text-foreground">مظنه</strong> در بازار طلای
          ایران یعنی{" "}
          <strong className="font-semibold text-foreground">
            قیمت یک مثقال طلای آب‌شده
          </strong>{" "}
          — عددی که بازار سنتی طلا هر روز حول آن معامله می‌کند و مبنای قیمت‌گذاری بقیه‌ی
          اجناس طلا است. یک مثقال بازاری ۴٫۶۰۸۳ گرم است و طلای آب‌شده معمولاً با عیار ۷۰۵
          (حدود ۱۷ عیار) دادوستد می‌شود؛ طلافروش‌ها از همین مظنه، قیمت هر گرم طلای ۱۸
          عیار را به دست می‌آورند.
        </p>

        <h2 className="mt-9 text-lg font-semibold text-foreground">
          مظنه یا مضنه؟ کدام املا درست است؟
        </h2>
        <p className="mt-3">
          املای درست{" "}
          <strong className="font-semibold text-foreground">«مظنه»</strong> است — از
          ریشه‌ی عربی{" "}
          <strong className="font-semibold text-foreground">مَظِنّة</strong> به معنای «جای
          گمان»: نرخی که انتظار می‌رود معامله حول آن بسته شود.{" "}
          <strong className="font-semibold text-foreground">«مضنه»</strong> غلط املایی
          رایجِ همان واژه است (گاهی هم «مزنه» نوشته می‌شود) و در جست‌وجوها فراوان دیده
          می‌شود؛ هر دو املا به همین مفهوم می‌رسند و اگر «مضنه طلا» را هم جست‌وجو کنید،
          مقصد همین‌جاست.
        </p>

        <h2 className="mt-9 text-lg font-semibold text-foreground">
          مظنه در مظنه آنلاین
        </h2>
        <p className="mt-3">
          مظنه آنلاین خودش هیچ نرخ مظنه یا میانگین بازاری اعلام نمی‌کند؛ هر عدد این سایت
          قیمت اعلامی یک سکوی مشخص در لحظه‌ی مشخص است. کاری که می‌کنیم مقایسه است:{" "}
          <strong className="font-semibold text-foreground">
            قیمت مؤثر خرید و فروش
          </strong>{" "}
          طلای آب‌شده در سکوهای آنلاین — با احتساب کارمزد هر سکو، نه قیمت اسمی — کنار هم،
          تا ببینید برای یک گرم طلا واقعاً چقدر می‌پردازید.
        </p>

        <p className="mt-8 text-[12px]">
          <a href="/" className="transition-smooth text-primary hover:underline">
            جدول مقایسه‌ی قیمت مؤثر سکوها
          </a>
        </p>
      </article>
    </PageShell>
  );
}
