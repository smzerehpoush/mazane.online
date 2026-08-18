import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { TOOLS, TOOLS_HUB_PATH } from "@/lib/tools";
import type { InternalLink } from "@/lib/tool-page";

const TITLE = "ابزارهای محاسبه‌ی قیمت طلا — تابلو";
const DESCRIPTION =
  "ماشین‌حساب‌های تابلو برای خرید و فروش طلا: اجرت ساخت، سود فروشنده و مالیات طلای نو، و مبلغی که بابت طلای دست‌دوم می‌گیرید.";
const BREADCRUMB_LABEL = "ابزارها";

const HEADING = "ابزارهای تابلو برای حساب کردن قیمت طلا";

const INTRO =
  "هر ابزار یک پرسش مشخص را جواب می‌دهد و با عددهای خودتان کار می‌کند. تابلو طلا نمی‌فروشد و پیشنهاد خرید و فروش نمی‌دهد؛ چیزی که می‌بینید حسابِ همان عددهایی است که وارد کرده‌اید.";

const RELATED_HEADING = "صفحه‌های مرتبط";

const RELATED: readonly InternalLink[] = [
  { href: "/tala-18", label: "مقایسه‌ی قیمت طلای ۱۸ عیار در سکوها" },
  { href: "/sekeh", label: "قیمت سکه" },
  { href: "/mazane-chist", label: "مظنه چیست؟" },
];

const TRUST_HEADING = "این عددها از کجا می‌آید و مسئولش کیست؟";

const TRUST_BODY =
  "نرخ پایه‌ی همه‌ی این ابزارها نرخ مرجع تابلو است که از tala.ir خوانده می‌شود و خودش سکوی خرید و فروش نیست. مسئولیت فرمول‌ها و منبع‌های هر صفحه با تابلو است؛ نام بازبین مستقلی هنوز روی صفحه‌ها نیست.";

const TRUST_LINKS: readonly InternalLink[] = [
  { href: "/methodology", label: "روش محاسبه و بروزرسانی قیمت‌ها" },
  { href: "/about", label: "درباره تابلو" },
];

export function toolsHubHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}${TOOLS_HUB_PATH}` },
      { property: "og:locale", content: "fa_IR" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${TOOLS_HUB_PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: BREADCRUMB_LABEL, url: `${SITE_URL}${TOOLS_HUB_PATH}` },
        ]),
      },
    ],
  };
}

export const Route = createFileRoute("/abzarha")({
  head: () => toolsHubHead(),
  component: ToolsHubPage,
});

export function ToolsHubPage() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: BREADCRUMB_LABEL }]} />

      <article className="glass-surface px-5 py-7 sm:px-8 sm:py-9">
        <p className="text-[12px] font-medium tracking-[0.18em] text-gold">{BREADCRUMB_LABEL}</p>
        <h1 className="mt-3 text-[28px] leading-[1.35] font-black text-foreground sm:text-[38px]">
          {HEADING}
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-foreground/85">{INTRO}</p>

        <ul data-tools-list className="mt-7 grid gap-3">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <a
                href={tool.href}
                data-tool-link={tool.href}
                className="transition-smooth block rounded-[20px] border border-border bg-surface px-5 py-4 hover:border-primary/40"
              >
                <h2 className="text-base font-bold text-foreground">{tool.action}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{tool.question}</p>
                <p className="mt-2 text-[13.5px] leading-7 text-foreground/80">{tool.summary}</p>
              </a>
            </li>
          ))}
        </ul>

        <nav aria-label={RELATED_HEADING} className="mt-9">
          <h2 className="text-lg font-semibold text-foreground">{RELATED_HEADING}</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">
            {RELATED.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition-smooth inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-foreground/80 hover:border-primary/40 hover:text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section
          data-tools-trust
          className="mt-9 rounded-[20px] border border-border bg-surface p-5"
        >
          <h2 className="text-base font-bold text-foreground">{TRUST_HEADING}</h2>
          <p className="mt-2 text-[13.5px] leading-7 text-foreground/80">{TRUST_BODY}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
            {TRUST_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-smooth text-primary hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PageShell>
  );
}
