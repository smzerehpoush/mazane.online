import { REGISTRY_PLATFORMS } from "./registry";
import type { InternalLink } from "./tool-page";
import { TOOLS_HUB_LINK } from "./tools";

export type ClusterId = "jewelry" | "sell-back" | "mazane" | "coin" | "platforms" | "gold-price";

export type RelatedKind = "tool" | "guide" | "price";

export interface RelatedCandidate extends InternalLink {
  kind: RelatedKind;
}

export interface RelatedLinks {
  cluster: ClusterId;
  heading: string;
  lead: string;
  tools: readonly [InternalLink, InternalLink];
  anchor: InternalLink;
  hub: InternalLink;
}

interface ClusterDefinition {
  heading: string;
  lead: string;
  terms: readonly string[];
  picks: readonly [RelatedCandidate, RelatedCandidate, RelatedCandidate, ...RelatedCandidate[]];
  prices: readonly [RelatedCandidate, RelatedCandidate, ...RelatedCandidate[]];
}

export const CLUSTER_IDS: readonly ClusterId[] = [
  "jewelry",
  "sell-back",
  "mazane",
  "coin",
  "platforms",
  "gold-price",
];

export const DEFAULT_CLUSTER: ClusterId = "gold-price";

const CLUSTERS: Readonly<Record<ClusterId, ClusterDefinition>> = {
  jewelry: {
    heading: "همین فاکتور را از زاویه‌های دیگر ببینید",
    lead: "اجرت و مالیات فقط بخشی از عددی است که پرداخته‌اید؛ این صفحه‌ها بقیه‌ی همان فاکتور را باز می‌کنند.",
    terms: [
      "اجرت",
      "فاکتور",
      "مالیات",
      "ارزش افزوده",
      "سود فروشنده",
      "طلای نو",
      "زینتی",
      "دستبند",
      "گردنبند",
      "انگشتر",
      "النگو",
      "ساخت",
    ],
    picks: [
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "حساب اجرت، سود و مالیات روی فاکتور طلای نو",
      },
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "همین قطعه را بفروشید، چقدر به شما می‌رسد؟",
      },
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه؛ عددی که طلافروش قیمت گرم را از آن درمی‌آورد",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "نرخ پایه‌ی این محاسبه‌ها چطور خوانده می‌شود",
      },
    ],
    prices: [
      { kind: "price", href: "/tala-18", label: "نرخ هر گرم طلای ۱۸ عیار در سکوهای آنلاین" },
      { kind: "price", href: "/", label: "تابلوی قیمت سکوهای آنلاین" },
    ],
  },

  "sell-back": {
    heading: "پیش از فروش، این‌ها را هم ببینید",
    lead: "مبلغی که خریدار پیشنهاد می‌دهد به نرخ امروز طلا گره خورده است، نه به قیمتی که روز خرید پرداختید.",
    terms: [
      "فروش طلا",
      "دست‌دوم",
      "دست دوم",
      "آب کردن",
      "ذوب",
      "کسر",
      "خریدار",
      "پس دادن",
      "بفروشم",
      "طلای شکسته",
    ],
    picks: [
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "محاسبه‌ی مبلغی که بابت طلای دست‌دوم می‌گیرید",
      },
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه؛ نرخی که خریدار طلای دست‌دوم با آن حساب می‌کند",
      },
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "همان اجرت و مالیاتی که روز خرید پرداختید",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "نرخ مرجع طلا از کجا خوانده می‌شود",
      },
    ],
    prices: [
      { kind: "price", href: "/tala-18", label: "نرخ امروز هر گرم طلای ۱۸ عیار" },
      { kind: "price", href: "/", label: "کارمزد خرید و فروش سکوها، کنار هم" },
    ],
  },

  mazane: {
    heading: "مظنه را به عدد امروزتان تبدیل کنید",
    lead: "مظنه قیمت یک مثقال آب‌شده است؛ نرخ هر گرم و مبلغ فاکتور از همین عدد بیرون می‌آید.",
    terms: ["مظنه", "مضنه", "مزنه", "آب‌شده", "آبشده", "مثقال", "عیار ۷۰۵", "بازار سنتی"],
    picks: [
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه چیست و املای درست آن کدام است",
      },
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "از نرخ گرم تا مبلغ فاکتور: اجرت، سود و مالیات",
      },
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "اگر طلای دست‌دومتان را بفروشید چقدر می‌گیرید",
      },
      {
        kind: "tool",
        href: "/tabdil-mazane",
        label: "مظنه‌ای که شنیده‌اید را به نرخ گرم تبدیل کنید",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "تابلو نرخ‌ها را چطور می‌خواند و کی به‌روز می‌کند",
      },
    ],
    prices: [
      { kind: "price", href: "/tala-18", label: "قیمت هر گرم طلای ۱۸ عیار در سکوها" },
      { kind: "price", href: "/", label: "نرخ اعلامی سکوها، همه در یک تابلو" },
    ],
  },

  coin: {
    heading: "سکه را کنار طلای گرمی بگذارید",
    lead: "قیمت سکه فقط وزن طلای داخلش نیست؛ برای دیدن این فاصله، نرخ گرم و مبنای بازار هم لازم است.",
    terms: ["سکه", "امامی", "نیم سکه", "ربع سکه", "بهار آزادی", "حباب", "ضرب"],
    picks: [
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه؛ مبنایی که ارزش طلای داخل سکه با آن سنجیده می‌شود",
      },
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "ماشین‌حساب اجرت و مالیات طلای زینتی",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "نرخ‌های روی این صفحه از کجا می‌آید",
      },
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "محاسبه‌ی مبلغ فروش طلای دست‌دوم",
      },
    ],
    prices: [
      { kind: "price", href: "/sekeh", label: "قیمت سکه امامی، نیم سکه و ربع سکه" },
      { kind: "price", href: "/tala-18", label: "نرخ هر گرم طلای ۱۸ عیار" },
    ],
  },

  platforms: {
    heading: "قیمت این سکو را با بقیه بسنجید",
    lead: "عدد اعلامی هر سکو پیش از کارمزد است؛ مقایسه وقتی معنا دارد که کارمزد و نرخ گرم کنار هم باشند.",
    terms: [
      "سکو",
      "کارمزد",
      "رفت‌وبرگشت",
      "رفت و برگشت",
      "آنلاین",
      "گواهی سپرده",
      "کیف پول",
      "اپلیکیشن",
      "حداقل سفارش",
      "تحویل فیزیکی",
    ],
    picks: [
      {
        kind: "tool",
        href: "/kodam-saku",
        label: "با سه پرسش ببینید کدام سکو به اولویت شما نزدیک‌تر است",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "کارمزدها و نرخ‌ها چطور جمع می‌شود و کی تازه می‌شود",
      },
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "اگر همین طلا را بفروشید چقدر برمی‌گردد",
      },
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "اجرت و مالیات طلای نو را جدا حساب کنید",
      },
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه چیست و چه نسبتی با نرخ گرم دارد",
      },
    ],
    prices: [
      { kind: "price", href: "/tala-18", label: "نرخ هر گرم طلای ۱۸ عیار در همه‌ی سکوها" },
      { kind: "price", href: "/", label: "همه‌ی سکوها با قیمت و کارمزدشان" },
    ],
  },

  "gold-price": {
    heading: "نرخ گرم را به تصمیم امروزتان وصل کنید",
    lead: "نرخ هر گرم نقطه‌ی شروع است؛ اجرت، کارمزد و نوع دارایی تعیین می‌کند در عمل چقدر می‌پردازید یا می‌گیرید.",
    terms: [
      "قیمت طلا",
      "نرخ طلا",
      "۱۸ عیار",
      "هر گرم",
      "انس",
      "نقره",
      "پلاتین",
      "سرمایه‌گذاری",
      "تورم",
    ],
    picks: [
      {
        kind: "tool",
        href: "/mohasebe-tala",
        label: "مبلغ فاکتور طلای نو را با نرخ امروز حساب کنید",
      },
      {
        kind: "guide",
        href: "/methodology",
        label: "این نرخ‌ها از کجا خوانده می‌شود و چند وقت یک‌بار",
      },
      {
        kind: "tool",
        href: "/mohasebe-forush-tala",
        label: "مبلغی که بابت طلای دست‌دوم به شما می‌رسد",
      },
      {
        kind: "guide",
        href: "/mazane-chist",
        label: "مظنه و مثقال، و نسبتشان با نرخ گرم",
      },
      {
        kind: "tool",
        href: "/kodam-saku",
        label: "انتخاب سکو بر پایه‌ی کارمزدی که برای شما مهم است",
      },
      {
        kind: "tool",
        href: "/tabdil-mazane",
        label: "عدد بازار سنتی را به همین نرخ گرم برگردانید",
      },
    ],
    prices: [
      { kind: "price", href: "/tala-18", label: "قیمت طلای ۱۸ عیار در سکوهای آنلاین" },
      { kind: "price", href: "/sekeh", label: "قیمت سکه، جدا از نرخ طلای گرمی" },
    ],
  },
};

/**
 * ⚠️ Only paths that actually mount `RelatedLinksBlock` belong here — neither
 * `/` (the home page's own layout, not the `PageShell`-based content
 * template) nor `/methodology` (a plain info page, same as `/about` which was
 * never added here) renders the block, so entries for them would be dead
 * lookups no code path ever reaches.
 */
const PATH_CLUSTERS: Readonly<Record<string, ClusterId>> = {
  "/mohasebe-tala": "jewelry",
  "/mohasebe-forush-tala": "sell-back",
  "/mazane-chist": "mazane",
  "/tabdil-mazane": "mazane",
  "/kodam-saku": "platforms",
  "/sekeh": "coin",
  "/tala-18": "gold-price",
};

export interface ClusteredPost {
  slug: string;
  title_fa: string;
  body_md: string;
}

const POST_CLUSTERS: Readonly<Record<string, ClusterId>> = {
  "govahi-seporde-tala-chist": "platforms",
  "behtarin-felez-baraye-sarmayegozari": "gold-price",
  "maliyat-tala-1405": "jewelry",
};

const TITLE_WEIGHT = 3;

function normalize(text: string): string {
  return text.replace(/‌/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");
}

function countTerm(text: string, term: string): number {
  if (term === "") return 0;
  return text.split(term).length - 1;
}

function scoreCluster(definition: ClusterDefinition, title: string, body: string): number {
  let score = 0;
  for (const raw of definition.terms) {
    const term = normalize(raw);
    score += countTerm(title, term) * TITLE_WEIGHT + countTerm(body, term);
  }
  return score;
}

export function clusterForPath(path: string): ClusterId {
  const declared = PATH_CLUSTERS[path];
  if (declared !== undefined) return declared;
  const slug = path.startsWith("/") ? path.slice(1) : path;
  if (REGISTRY_PLATFORMS.some((platform) => platform.slug === slug)) return "platforms";
  return DEFAULT_CLUSTER;
}

export function clusterForPost(post: ClusteredPost): ClusterId {
  const declared = POST_CLUSTERS[post.slug];
  if (declared !== undefined) return declared;
  const title = normalize(post.title_fa);
  const body = normalize(post.body_md);
  let best: ClusterId = DEFAULT_CLUSTER;
  let bestScore = 0;
  for (const id of CLUSTER_IDS) {
    const score = scoreCluster(CLUSTERS[id], title, body);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function plainLink(candidate: RelatedCandidate): InternalLink {
  return { href: candidate.href, label: candidate.label };
}

export function relatedLinks(cluster: ClusterId, currentPath: string): RelatedLinks {
  const definition = CLUSTERS[cluster];
  const picks = definition.picks.filter((candidate) => candidate.href !== currentPath);
  const prices = definition.prices.filter((candidate) => candidate.href !== currentPath);
  const [first, second] = picks;
  const [anchor] = prices;
  if (first === undefined || second === undefined || anchor === undefined) {
    throw new Error(
      `cluster "${cluster}" has too few candidates left after excluding ${currentPath}`,
    );
  }
  return {
    cluster,
    heading: definition.heading,
    lead: definition.lead,
    tools: [plainLink(first), plainLink(second)],
    anchor: plainLink(anchor),
    hub: TOOLS_HUB_LINK,
  };
}

export function relatedLinksForPath(path: string): RelatedLinks {
  return relatedLinks(clusterForPath(path), path);
}

export function relatedLinksForPost(post: ClusteredPost): RelatedLinks {
  return relatedLinks(clusterForPost(post), `/blog/${post.slug}`);
}

export function clusterCandidates(cluster: ClusterId): readonly RelatedCandidate[] {
  const definition = CLUSTERS[cluster];
  return [...definition.picks, ...definition.prices];
}
