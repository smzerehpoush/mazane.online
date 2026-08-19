import type { ReactNode } from "react";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { RelatedLinksBlock } from "@/components/content/RelatedLinks";
import type { RelatedLinks } from "@/lib/clusters";
import { formatDateFa } from "@/lib/format";
import type { FaqItem } from "@/lib/structured-data";
import {
  type ToolByline,
  type ToolFaqList,
  type ToolFormula,
  type ToolPageIdentity,
  type ToolSourceList,
} from "@/lib/tool-page";

const BRIDGE = {
  heading: "قیمت خود طلا را هم مقایسه کنید",
  body: "نرخ هر گرم طلا در سکوهای مختلف یکسان نیست و این اختلاف گاهی از اجرت هم بزرگ‌تر می‌شود. تابلو نرخ سکوها را کنار هم می‌گذارد تا پیش از تصمیم، اندازه‌ی این فاصله را ببینید.",
  link: { href: "/tala-18", label: "مقایسه‌ی قیمت طلای ۱۸ عیار در سکوها" },
} as const;

const HEADINGS = {
  formula: "فرمول و یک مثال کامل",
  example: "مثال",
  faq: "پرسش‌های پرتکرار",
  sources: "منبع‌ها",
} as const;

const BYLINE_LABELS = {
  author: "نویسنده",
  reviewer: "بازبینی محتوا",
  published: "انتشار",
  updated: "آخرین به‌روزرسانی",
  accountability: "مسئولیت فرمول و منبع‌های این صفحه با تابلو است.",
} as const;

export interface ToolPageProps {
  identity: ToolPageIdentity;
  tool: ReactNode;
  breakdown: ReactNode;
  interpretation: ReactNode | null;
  formula: ToolFormula;
  faq: ToolFaqList;
  sources: ToolSourceList;
  byline: ToolByline;
  related: RelatedLinks;
}

function BridgeBox() {
  return (
    <section
      data-tool-part="bridge"
      className="mt-6 rounded-[22px] border border-gold/25 bg-gold-soft/50 px-5 py-5"
    >
      <h2 className="text-base font-bold text-foreground">{BRIDGE.heading}</h2>
      <p className="mt-2 text-[14px] leading-8 text-foreground/80">{BRIDGE.body}</p>
      <p className="mt-3 text-[13px]">
        <a href={BRIDGE.link.href} className="transition-smooth text-primary hover:underline">
          {BRIDGE.link.label}
        </a>
      </p>
    </section>
  );
}

function FormulaBlock({ formula }: { formula: ToolFormula }) {
  return (
    <section data-tool-part="formula" className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{HEADINGS.formula}</h2>

      <ul className="mt-3 space-y-2 rounded-[18px] border border-border bg-surface p-4 text-[14px] leading-8 text-foreground/85">
        {formula.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h3 className="mt-6 text-base font-semibold text-foreground">{HEADINGS.example}</h3>
      <p className="mt-2 text-[14px] leading-8 text-foreground/80">{formula.example.premise}</p>

      <dl className="mt-3 divide-y divide-border rounded-[18px] border border-border bg-surface px-4">
        {formula.example.steps.map((step) => (
          <div key={step.label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[13px] text-muted-foreground">{step.label}</dt>
            <dd className="num text-[14px] text-foreground">{step.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-[13px] font-semibold text-foreground">
            {formula.example.result.label}
          </dt>
          <dd className="num text-[15px] font-semibold text-primary">
            {formula.example.result.value}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function FaqBlock({ faq }: { faq: readonly FaqItem[] }) {
  return (
    <section data-tool-part="faq" className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{HEADINGS.faq}</h2>
      <div className="mt-4 space-y-4">
        {faq.map((item) => (
          <section
            key={item.question}
            className="rounded-[18px] border border-border bg-surface p-4"
          >
            <h3 className="font-semibold text-foreground">{item.question}</h3>
            <p className="mt-2 text-[13px] leading-7 text-foreground/78">{item.answer}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

function SourcesBlock({ sources }: { sources: ToolSourceList }) {
  return (
    <section data-tool-part="sources" className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{HEADINGS.sources}</h2>
      <ul className="mt-3 space-y-3 text-[13px] leading-7 text-foreground/80">
        {sources.map((source) => (
          <li key={source.claim} className="rounded-[16px] border border-border bg-surface p-4">
            <p>{source.claim}</p>
            <p className="mt-1.5 text-muted-foreground">
              {source.href === undefined ? (
                source.citation
              ) : (
                <a
                  href={source.href}
                  target="_blank"
                  rel="nofollow noopener"
                  className="transition-smooth text-primary hover:underline"
                >
                  {source.citation}
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BylineBlock({ byline }: { byline: ToolByline }) {
  return (
    <section
      data-tool-part="byline"
      className="mt-8 rounded-[18px] border border-border bg-surface p-4 text-[12px] leading-7 text-muted-foreground"
    >
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {byline.author !== null && (
          <div className="flex gap-1.5">
            <dt>{BYLINE_LABELS.author}:</dt>
            <dd className="text-foreground/80">{byline.author}</dd>
          </div>
        )}
        {byline.reviewer !== null && (
          <div className="flex gap-1.5">
            <dt>{BYLINE_LABELS.reviewer}:</dt>
            <dd className="text-foreground/80">{byline.reviewer}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>{BYLINE_LABELS.published}:</dt>
          <dd className="text-foreground/80">
            <time dateTime={byline.publishedAt}>{formatDateFa(byline.publishedAt)}</time>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{BYLINE_LABELS.updated}:</dt>
          <dd className="text-foreground/80">
            <time dateTime={byline.updatedAt}>{formatDateFa(byline.updatedAt)}</time>
          </dd>
        </div>
      </dl>
      <p className="mt-2">{BYLINE_LABELS.accountability}</p>
    </section>
  );
}

export function ToolPage(props: ToolPageProps) {
  const faq: readonly FaqItem[] = props.faq;

  return (
    <PageShell>
      <Breadcrumbs
        items={[{ label: "خانه", href: "/" }, { label: props.identity.breadcrumbLabel }]}
      />

      <article className="card-surface px-5 py-6 sm:px-8 sm:py-8">
        <h1
          data-tool-part="question"
          className="text-[26px] leading-[1.4] font-black text-foreground sm:text-[34px]"
        >
          {props.identity.question}
        </h1>

        <div data-tool-part="tool" className="mt-5">
          {props.tool}
        </div>

        <div data-tool-part="breakdown" className="mt-4">
          {props.breakdown}
        </div>

        {props.interpretation !== null && (
          <p
            data-tool-part="interpretation"
            className="mt-4 text-[14px] leading-8 text-foreground/85"
          >
            {props.interpretation}
          </p>
        )}

        <BridgeBox />
        <FormulaBlock formula={props.formula} />
        <FaqBlock faq={faq} />
        <SourcesBlock sources={props.sources} />
        <BylineBlock byline={props.byline} />
        <RelatedLinksBlock links={props.related} toolPart="related" />
      </article>
    </PageShell>
  );
}
