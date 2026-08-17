import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolPage, type ToolPageProps } from "../src/components/content/ToolPage";
import { MAIN_LANDMARK_ID } from "../src/lib/site-content";
import { SITE_URL } from "../src/lib/site";
import {
  toolPageHead,
  TOOL_FAQ_MAX,
  TOOL_FAQ_MIN,
  type ToolByline,
  type ToolFaqList,
  type ToolPageIdentity,
  type ToolSourceList,
} from "../src/lib/tool-page";

const IDENTITY: ToolPageIdentity = {
  path: "/mohasebe-tala",
  title: "محاسبه‌ی قیمت طلای زینتی با اجرت، سود و مالیات — تابلو",
  description:
    "قیمت نهایی طلای زینتی را جزءبه‌جزء ببینید: ارزش خود طلا، اجرت ساخت، سود فروشنده و مالیات بر ارزش افزوده، بر پایه‌ی نرخ روز هر گرم.",
  breadcrumbLabel: "ماشین‌حساب طلای زینتی",
  question: "اجرت ساخت طلایی که خریدم چقدر بوده؟",
};

const FAQ: ToolFaqList = [
  {
    question: "مالیات بر ارزش افزوده روی کل مبلغ طلا حساب می‌شود؟",
    answer:
      "نه. طبق بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰، اصل طلا معاف است و مالیات فقط به اجرت ساخت، حق‌العمل و سود فروشنده تعلق می‌گیرد. اگر در فاکتور شما مالیات روی جمع کل بسته شده باشد، مبلغ از چیزی که قانون گفته بیشتر است.",
  },
  {
    question: "نرخ مالیات طلا امسال چند درصد است؟",
    answer:
      "از سال ۱۴۰۴ ده درصد است؛ بند «خ» تبصره (۱) قانون بودجه ۱۴۰۴. تا پایان ۱۴۰۳ همان نه درصدِ بند (ب) ماده (۲۶) اعمال می‌شد. این نرخ هر سال با قانون بودجه عوض می‌شود، برای همین عدد داخل ماشین‌حساب قابل ویرایش است.",
  },
  {
    question: "سود فروشنده حتماً ۷ درصد است؟",
    answer:
      "نه. هفت درصد عرف بازار است و رئیس وقت اتحادیه طلا و جواهر تهران بارها آن را در مصاحبه‌ها گفته، ولی نرخ‌نامه یا مصوبه‌ی منتشرشده‌ای پشت آن نیست. این عدد در ماشین‌حساب یک مقدار پیش‌فرض قابل تغییر است، نه یک نرخ رسمی.",
  },
  {
    question: "چرا اجرت درصدی از قیمت طلاست و مبلغ ثابت نیست؟",
    answer:
      "چون اجرت در بازار ایران معمولاً به‌صورت درصدی از ارزش طلای همان مصنوع اعلام می‌شود. نتیجه این است که با بالا رفتن نرخ طلا، مبلغ ریالی اجرت هم بالا می‌رود، حتی وقتی درصد اجرت ثابت مانده است.",
  },
  {
    question: "محدوده‌ی معمول اجرت در بازار چقدر است؟",
    answer:
      "منبع رسمی و قابل استنادی برای این محدوده وجود ندارد. آرشیو اطلاعیه‌ها و بخشنامه‌های اتحادیه طلا و جواهر تهران هیچ نرخ‌نامه‌ای درباره‌ی اجرت ندارد و صفحه‌ی نرخ مرجع اتحادیه هم فقط قیمت اعلام می‌کند. تابلو عددی را که سند ندارد نمی‌نویسد، پس این ماشین‌حساب اجرت شما را با «حد معمول» مقایسه نمی‌کند.",
  },
  {
    question: "فاکتور باید چه چیزهایی را جدا نوشته باشد؟",
    answer:
      "همان بند (ب) ماده (۲۶) درج تفکیکی ارزش اصل طلا، اجرت ساخت، حق‌العمل و سود فروشنده را در صورت‌حساب الکترونیکی الزامی کرده است. اگر فاکتور شما فقط یک عدد کل دارد، این تفکیک انجام نشده است.",
  },
  {
    question: "نرخ هر گرم طلا در این صفحه از کجا می‌آید؟",
    answer:
      "از نرخ مرجع تابلو که از tala.ir خوانده می‌شود و خودش سکوی فروش نیست. اگر داده‌ی تازه در دسترس نباشد، به‌جای نشان دادن عدد قدیمی به‌عنوان نرخ قطعی، وضعیت کهنگی کنار آن نوشته می‌شود.",
  },
];

const SOURCES: ToolSourceList = [
  {
    claim:
      "مالیات بر ارزش افزوده فقط به اجرت ساخت، حق‌العمل و سود فروشنده تعلق می‌گیرد و اصل طلا معاف است.",
    citation: "بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده، مصوب ۱۴۰۰/۰۳/۰۲",
  },
  {
    claim: "نرخ مالیات اجرت و سود از سال ۱۴۰۴ ده درصد است.",
    citation:
      "بند «خ» تبصره (۱) قانون بودجه سال ۱۴۰۴ و اطلاعیه‌ی اتحادیه طلا و جواهر تهران، ۱۶ فروردین ۱۴۰۴",
    href: "https://www.estjt.ir/category/notices-and-circulars/",
  },
  {
    claim: "برای درصد اجرت ساخت هیچ نرخ‌نامه یا مصوبه‌ی منتشرشده‌ای وجود ندارد.",
    citation:
      "آرشیو اطلاعیه‌ها و بخشنامه‌های اتحادیه طلا و جواهر تهران، اطلاعیه‌ی ۱ تا ۵۲، از ۱۳۹۹ تا بهمن ۱۴۰۴",
  },
];

const BYLINE: ToolByline = {
  author: null,
  reviewer: null,
  publishedAt: "2026-08-18",
  updatedAt: "2026-08-18",
};

const PROPS: ToolPageProps = {
  identity: IDENTITY,
  tool: <div data-testid="tool-widget">ورودی وزن و درصدها</div>,
  breakdown: <div data-testid="breakdown-widget">ارزش طلا، اجرت، سود، مالیات و مبلغ نهایی</div>,
  interpretation:
    "از این مبلغ، ۱۵٬۶۲۰٬۰۰۰ تومان هزینه‌ی افزوده روی ارزش طلاست؛ یعنی ۳۱٫۲ درصد بیشتر از ارزش خود طلا.",
  formula: {
    lines: [
      "ارزش طلا = وزن به گرم × نرخ هر گرم طلای ۱۸ عیار",
      "اجرت ساخت = ارزش طلا × درصد اجرت",
      "سود فروشنده = (ارزش طلا + اجرت) × درصد سود",
      "مالیات بر ارزش افزوده = (اجرت + سود) × نرخ مالیات",
      "مبلغ نهایی = ارزش طلا + اجرت + سود + مالیات",
    ],
    example: {
      premise:
        "فرض کنید ۵ گرم طلای ۱۸ عیار با اجرت ۲۰ درصد، سود ۷ درصد و مالیات ۱۰ درصد خریده‌اید و نرخ هر گرم در آن لحظه ۱۰٬۰۰۰٬۰۰۰ تومان بوده است.",
      steps: [
        { label: "ارزش طلا", value: "۵۰٬۰۰۰٬۰۰۰ تومان" },
        { label: "اجرت ساخت (۲۰٪)", value: "۱۰٬۰۰۰٬۰۰۰ تومان" },
        { label: "سود فروشنده (۷٪)", value: "۴٬۲۰۰٬۰۰۰ تومان" },
        { label: "مالیات روی اجرت و سود (۱۰٪)", value: "۱٬۴۲۰٬۰۰۰ تومان" },
      ],
      result: { label: "مبلغ نهایی", value: "۶۵٬۶۲۰٬۰۰۰ تومان" },
    },
  },
  faq: FAQ,
  sources: SOURCES,
  byline: BYLINE,
  related: {
    tools: [
      { href: "/mohasebe-forush-tala", label: "ماشین‌حساب فروش طلای دست‌دوم" },
      { href: "/faktor-sanj", label: "فاکتورسنج طلا" },
    ],
    hub: { href: "/abzarha", label: "همه‌ی ابزارهای تابلو" },
  },
};

function render(overrides: Partial<ToolPageProps> = {}): string {
  return renderToStaticMarkup(<ToolPage {...PROPS} {...overrides} />);
}

function partIndex(html: string, part: string): number {
  const index = html.indexOf(`data-tool-part="${part}"`);
  if (index === -1) throw new Error(`the tool template is missing part "${part}"`);
  return index;
}

function anchorTags(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
}

function attrOf(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : (match[1] ?? null);
}

describe("tool page template — the ten parts", () => {
  it("the H1 is the user's question, not the tool's name", () => {
    const html = render();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1?.[1]).toBe("اجرت ساخت طلایی که خریدم چقدر بوده؟");
    expect(h1?.[1]).not.toContain("ماشین‌حساب");
  });

  it("the tool comes straight after the H1, with no preamble prose in between", () => {
    const html = render();
    const between = html.slice(html.indexOf("</h1>") + "</h1>".length, partIndex(html, "tool"));
    expect(between).not.toMatch(/[؀-ۿ]/);
  });

  it("renders the tool and the breakdown as two separate slots", () => {
    const html = render();
    expect(html).toContain('data-testid="tool-widget"');
    expect(html).toContain('data-testid="breakdown-widget"');
    expect(partIndex(html, "tool")).toBeLessThan(partIndex(html, "breakdown"));
  });

  it("the ten parts render in the order the template promises", () => {
    const html = render();
    const order = [
      "question",
      "tool",
      "breakdown",
      "interpretation",
      "bridge",
      "formula",
      "faq",
      "sources",
      "byline",
      "related",
    ].map((part) => partIndex(html, part));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("tool page template — interpretation is optional", () => {
  it("renders the interpretation line when the tool supplies one", () => {
    const html = render();
    expect(html).toContain("۳۱٫۲ درصد بیشتر از ارزش خود طلا");
  });

  /**
   * ⚠️ Issue #90 swept the whole Tehran union announcement archive and found
   * no citable "usual market ojrat range". A tool with nothing sourced to say
   * must be able to say nothing, so `interpretation: null` is a legitimate
   * value and not a missing part.
   */
  it("renders no interpretation block at all when the tool has nothing sourced to say", () => {
    const html = render({ interpretation: null });
    expect(html).not.toContain('data-tool-part="interpretation"');
    expect(html).toContain('data-tool-part="breakdown"');
    expect(html).toContain('data-tool-part="bridge"');
  });

  it("never compares the user's number to an invented market range", () => {
    const html = render();
    expect(html).not.toContain("بالاتر از محدوده‌ی معمول بازار");
    expect(html).toContain("منبع رسمی و قابل استنادی برای این محدوده وجود ندارد");
  });
});

describe("tool page template — the bridge box", () => {
  it("is a plain section linking to the internal comparison, not a popup", () => {
    const html = render();
    const bridge = html.slice(partIndex(html, "bridge"), partIndex(html, "formula"));
    expect(bridge).toContain('href="/tala-18"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("aria-modal");
  });

  it("carries no outbound platform link, so it needs no sponsored rel", () => {
    const html = render();
    const bridge = html.slice(partIndex(html, "bridge"), partIndex(html, "formula"));
    expect(bridge).not.toMatch(/href="https?:\/\//);
    expect(bridge).not.toContain("/go/");
  });
});

describe("tool page template — formula and worked example", () => {
  it("prints every formula line", () => {
    const html = render();
    for (const line of PROPS.formula.lines) expect(html).toContain(line);
  });

  it("prints the worked example end to end, including the final number", () => {
    const html = render();
    expect(html).toContain(PROPS.formula.example.premise);
    for (const step of PROPS.formula.example.steps) {
      expect(html).toContain(step.label);
      expect(html).toContain(step.value);
    }
    expect(html).toContain("۶۵٬۶۲۰٬۰۰۰ تومان");
  });
});

describe("tool page template — FAQ and its schema", () => {
  it("keeps the question count inside the five-to-eight window", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(TOOL_FAQ_MIN);
    expect(FAQ.length).toBeLessThanOrEqual(TOOL_FAQ_MAX);
  });

  it("renders every question and answer as visible HTML", () => {
    const html = render();
    for (const item of FAQ) {
      expect(html).toContain(item.question);
      expect(html).toContain(item.answer);
    }
  });

  it("visible answers keep Persian digits", () => {
    const html = render();
    expect(html).toContain("ماده (۲۶)");
  });

  /**
   * ⚠️ The rule the ticket calls out by name: Persian digits are correct in
   * the visible page and wrong inside JSON-LD. Both come from the same source
   * string, so this only holds while `toolFaqForSchema` stays in the path.
   */
  it("the FAQPage schema carries the same answers with Latin digits", () => {
    const head = toolPageHead({ identity: IDENTITY, faq: FAQ, byline: BYLINE });
    const faqScript = head.scripts.find((script) => script.children.includes("FAQPage"));
    expect(faqScript).toBeDefined();
    const json = faqScript?.children ?? "";
    expect(json).not.toMatch(/[۰-۹٠-٩]/);
    expect(json).toContain("ماده (26)");
    expect(json).toContain("1400");
    expect(JSON.parse(json).mainEntity).toHaveLength(FAQ.length);
  });
});

describe("tool page template — sources", () => {
  it("prints a claim and its citation for every sourced statement", () => {
    const html = render();
    for (const source of SOURCES) {
      expect(html).toContain(source.claim);
      expect(html).toContain(source.citation);
    }
  });

  it("the VAT claim is cited to the law, not left bare", () => {
    const html = render();
    expect(html).toContain("قانون مالیات بر ارزش افزوده، مصوب ۱۴۰۰/۰۳/۰۲");
  });

  /**
   * ⚠️ A citation link is not a revenue link, so it never gets `sponsored` —
   * but it must still be a dead end for link equity and must never point at a
   * platform that pays us.
   */
  it("outbound citation links are nofollow noopener and go nowhere near a platform", () => {
    const html = render();
    const external = anchorTags(html).filter((tag) =>
      /^https?:\/\//.test(attrOf(tag, "href") ?? ""),
    );
    expect(external.length).toBeGreaterThan(0);
    for (const tag of external) {
      const rel = new Set((attrOf(tag, "rel") ?? "").split(/\s+/).filter(Boolean));
      expect(rel.has("nofollow")).toBe(true);
      expect(rel.has("noopener")).toBe(true);
      expect(new URL(attrOf(tag, "href") ?? "").hostname).toBe("www.estjt.ir");
    }
  });
});

describe("tool page template — byline", () => {
  it("prints both dates as machine-readable time elements", () => {
    const html = render();
    expect(html).toMatch(/<time datetime="2026-08-18"/i);
    expect(html).toContain("انتشار");
    expect(html).toContain("آخرین به‌روزرسانی");
  });

  /**
   * ⚠️ Naming a real author and reviewer is issue #55 and needs a human to
   * decide who they are. Until then the slot renders nothing rather than a
   * placeholder person.
   */
  it("invents nobody while the author and reviewer slots are empty", () => {
    const html = render();
    expect(html).not.toContain("نویسنده:");
    expect(html).not.toContain("بازبینی محتوا:");
    expect(html).toContain("مسئولیت فرمول و منبع‌های این صفحه با تابلو است.");
  });

  it("renders author and reviewer once a real person fills the slot", () => {
    const html = render({
      byline: { ...BYLINE, author: "نام نویسنده", reviewer: "نام بازبین" },
    });
    expect(html).toContain("نویسنده");
    expect(html).toContain("نام نویسنده");
    expect(html).toContain("بازبینی محتوا");
    expect(html).toContain("نام بازبین");
  });
});

describe("tool page template — internal links", () => {
  it("links two related tools, the hub and the gold price page", () => {
    const html = render();
    const related = html.slice(partIndex(html, "related"));
    for (const href of ["/mohasebe-forush-tala", "/faktor-sanj", "/abzarha", "/tala-18"]) {
      expect(related).toContain(`href="${href}"`);
    }
  });
});

describe("tool page template — head and structured data", () => {
  it("has a flat canonical and a breadcrumb back to the home page", () => {
    const head = toolPageHead({ identity: IDENTITY, faq: FAQ, byline: BYLINE });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/mohasebe-tala`,
    });
    const breadcrumb = head.scripts.find((script) => script.children.includes("BreadcrumbList"));
    expect(breadcrumb?.children).toContain(`${SITE_URL}/mohasebe-tala`);
    expect(breadcrumb?.children).toContain("خانه");
  });

  it("the WebPage node carries both dates and no invented person", () => {
    const head = toolPageHead({ identity: IDENTITY, faq: FAQ, byline: BYLINE });
    const script = head.scripts.find((item) => item.children.includes('"WebPage"'));
    const node = JSON.parse(script?.children ?? "{}");
    expect(node.datePublished).toBe("2026-08-18");
    expect(node.dateModified).toBe("2026-08-18");
    expect(node.author).toBeUndefined();
    expect(node.reviewedBy).toBeUndefined();
    expect(script?.children).not.toMatch(/[۰-۹٠-٩]/);
  });

  it("the WebPage node grows an author and a reviewer when they exist", () => {
    const head = toolPageHead({
      identity: IDENTITY,
      faq: FAQ,
      byline: { ...BYLINE, author: "نام نویسنده", reviewer: "نام بازبین" },
    });
    const script = head.scripts.find((item) => item.children.includes('"WebPage"'));
    const node = JSON.parse(script?.children ?? "{}");
    expect(node.author).toEqual({ "@type": "Person", name: "نام نویسنده" });
    expect(node.reviewedBy).toEqual({ "@type": "Person", name: "نام بازبین" });
    expect(node.lastReviewed).toBe("2026-08-18");
  });
});

describe("tool page template — landmark and skip link", () => {
  it("the skip link comes before the main landmark it targets", () => {
    const html = render();
    const skip = html.indexOf(`href="#${MAIN_LANDMARK_ID}"`);
    const landmark = html.indexOf(`<main id="${MAIN_LANDMARK_ID}"`);
    expect(skip).toBeGreaterThan(-1);
    expect(landmark).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(landmark);
  });

  it("the main landmark is focusable so the skip link actually moves focus", () => {
    const html = render();
    expect(html).toMatch(new RegExp(`<main id="${MAIN_LANDMARK_ID}"[^>]*tabindex="-1"`));
  });

  it("names the skip target in Persian", () => {
    const html = render();
    expect(html).toContain("رفتن به محتوای اصلی");
  });
});
