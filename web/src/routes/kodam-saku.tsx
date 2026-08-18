import { createFileRoute } from "@tanstack/react-router";

import { Madde5Bar } from "@/components/content/LegalNotice";
import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { PlatformWizard } from "@/components/content/PlatformWizard";
import { RelatedLinksBlock } from "@/components/content/RelatedLinks";
import { relatedLinksForPath } from "@/lib/clusters";
import { ogImageAlt, ogImageMeta, ogKeyForPath } from "@/lib/og";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { WIZARD_PATH, wizardSearchOf, type WizardSearch } from "@/lib/wizard";
import { loadWizardData, type WizardPageData } from "@/lib/wizard-data";

const TITLE = "کدام سکوی خرید طلا برای من؟ — تابلو";
const DESCRIPTION =
  "سه پرسش کوتاه درباره‌ی مبلغ خرید، تحویل فیزیکی و فروش کوتاه‌مدت، و بعد یک پیشنهاد با معیار روشن: کم‌ترین کارمزد اعلامی در همان چیزی که برای شما مهم است.";
const BREADCRUMB_LABEL = "کدام سکو؟";

const HEADING = "کدام سکو برای من؟";

const INTRO =
  "سه پرسش می‌پرسیم و بر پایه‌ی عددهایی که خود سکوها اعلام کرده‌اند جواب می‌دهیم. تابلو نمی‌گوید کدام سکو بهتر است؛ می‌گوید در معیاری که با جواب‌های شما انتخاب شده، کم‌ترین عدد اعلامی مال کدام سکوست.";

const METHOD_HEADING = "این پیشنهاد چطور ساخته می‌شود";

const METHOD_POINTS: readonly string[] = [
  "جواب شما یک ستون از جدول مقایسه را انتخاب می‌کند، نه یک امتیاز ترکیبی. تابلو عدد تازه‌ای نمی‌سازد و قیمت را در کارمزد ضرب نمی‌کند.",
  "سکویی که عدد آن ستون را عمومی اعلام نکرده باشد، پیشنهاد نمی‌شود؛ سکوت یک سکو به‌جای ارزانی خوانده نمی‌شود.",
  "اگر داده‌ی لازم برای جواب دادن به خواسته‌ی شما را نداریم، همین را می‌نویسیم و سکویی پیشنهاد نمی‌کنیم.",
];

export function wizardHead() {
  const url = `${SITE_URL}${WIZARD_PATH}`;
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:locale", content: "fa_IR" },
      ...ogImageMeta({ key: ogKeyForPath(WIZARD_PATH), alt: ogImageAlt(HEADING) }),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: BREADCRUMB_LABEL, url },
        ]),
      },
    ],
  };
}

/**
 * ⚠️ The three answers live in the query string, never in React state: the
 * prices and fees the recommendation is built from are server-rendered, so the
 * answer has to exist in the first HTML response. `validateSearch` also
 * normalizes the amount to Latin digits, and `wizardHead` keeps the canonical
 * at `/kodam-saku`, so the answered variants never compete in the index.
 */
export const Route = createFileRoute("/kodam-saku")({
  validateSearch: (search: Record<string, unknown>): WizardSearch =>
    wizardSearchOf({
      amount: search["amount"],
      delivery: search["delivery"],
      resale: search["resale"],
    }),
  loader: async (): Promise<WizardPageData> => loadWizardData(),
  head: () => wizardHead(),
  component: WizardRoute,
});

export function WizardPage({
  data,
  search,
  onSubmit,
}: {
  data: WizardPageData;
  search: WizardSearch;
  onSubmit?: ((next: WizardSearch) => void) | undefined;
}) {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: BREADCRUMB_LABEL }]} />

      <article className="glass-surface px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[12px] font-medium tracking-[0.18em] text-gold">راهنمای انتخاب</p>
        <h1 className="mt-3 text-[26px] leading-[1.4] font-black text-foreground sm:text-[34px]">
          {HEADING}
        </h1>
        <p className="mt-4 text-[14.5px] leading-8 text-foreground/85">{INTRO}</p>

        <div className="mt-7 border-t border-border/70 pt-7">
          <PlatformWizard data={data} search={search} onSubmit={onSubmit} />
        </div>

        <section
          data-wizard-method
          className="mt-8 rounded-[20px] border border-border bg-surface p-5"
        >
          <h2 className="text-[15px] font-bold text-foreground">{METHOD_HEADING}</h2>
          <ul className="mt-3 list-disc space-y-2 pr-5 text-[13px] leading-7 text-foreground/80">
            {METHOD_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </article>

      <RelatedLinksBlock
        links={relatedLinksForPath(WIZARD_PATH)}
        className="glass-surface mt-6 px-5 py-5 sm:px-6"
      />

      <Madde5Bar />
    </PageShell>
  );
}

function WizardRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <WizardPage
      data={Route.useLoaderData()}
      search={search}
      onSubmit={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
