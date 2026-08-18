import { toLatinNumerals } from "./fa-number";
import { ogImageAlt, ogImageMeta, ogKeyForPath } from "./og";
import { SITE_URL } from "./site";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdString, type FaqItem } from "./structured-data";

export interface InternalLink {
  href: string;
  label: string;
}

export interface ToolSourceNote {
  claim: string;
  citation: string;
  href?: string;
}

export interface WorkedExampleStep {
  label: string;
  value: string;
}

export interface ToolWorkedExample {
  premise: string;
  steps: readonly WorkedExampleStep[];
  result: WorkedExampleStep;
}

export interface ToolFormula {
  lines: readonly string[];
  example: ToolWorkedExample;
}

export interface ToolByline {
  author: string | null;
  reviewer: string | null;
  publishedAt: string;
  updatedAt: string;
}

export interface ToolPageIdentity {
  path: string;
  title: string;
  description: string;
  breadcrumbLabel: string;
  question: string;
}

/**
 * ⚠️ A union of tuples, not `FaqItem[]`: the five-to-eight rule from the tool
 * template is enforced by `tsc`, so a tool page with four questions fails the
 * typecheck instead of shipping a thin FAQ that no test would notice.
 */
export type ToolFaqList =
  | readonly [FaqItem, FaqItem, FaqItem, FaqItem, FaqItem]
  | readonly [FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem]
  | readonly [FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem]
  | readonly [FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem, FaqItem];

export type ToolSourceList = readonly [ToolSourceNote, ...ToolSourceNote[]];

export const TOOL_FAQ_MIN = 5;
export const TOOL_FAQ_MAX = 8;

export function toolPageUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * ⚠️ Every string that reaches JSON-LD goes through `toLatinNumerals` first.
 * The visible page keeps Persian digits, the schema gets Latin ones, and both
 * come from a single source string — so the two can never drift apart.
 */
export function toolFaqForSchema(faq: readonly FaqItem[]): FaqItem[] {
  return faq.map((item) => ({
    question: toLatinNumerals(item.question),
    answer: toLatinNumerals(item.answer),
  }));
}

export function toolWebPageJsonLd(identity: ToolPageIdentity, byline: ToolByline): string {
  const url = toolPageUrl(identity.path);
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: toLatinNumerals(identity.question),
    description: toLatinNumerals(identity.description),
    inLanguage: "fa",
    datePublished: byline.publishedAt,
    dateModified: byline.updatedAt,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  if (byline.author !== null) {
    node["author"] = { "@type": "Person", name: byline.author };
  }
  if (byline.reviewer !== null) {
    node["reviewedBy"] = { "@type": "Person", name: byline.reviewer };
    node["lastReviewed"] = byline.updatedAt;
  }
  return jsonLdString(node);
}

export interface ToolPageSeo {
  identity: ToolPageIdentity;
  faq: readonly FaqItem[];
  byline: ToolByline;
}

export function toolPageHead(input: ToolPageSeo) {
  const url = toolPageUrl(input.identity.path);
  return {
    meta: [
      { title: input.identity.title },
      { name: "description", content: input.identity.description },
      { property: "og:title", content: input.identity.title },
      { property: "og:description", content: input.identity.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:locale", content: "fa_IR" },
      ...ogImageMeta({
        key: ogKeyForPath(input.identity.path),
        alt: ogImageAlt(input.identity.breadcrumbLabel),
      }),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          {
            name: toLatinNumerals(input.identity.breadcrumbLabel),
            url,
          },
        ]),
      },
      {
        type: "application/ld+json",
        children: faqPageJsonLd(toolFaqForSchema(input.faq)),
      },
      {
        type: "application/ld+json",
        children: toolWebPageJsonLd(input.identity, input.byline),
      },
    ],
  };
}
