/**
 * ⚠️ The wizard is the only surface on the site that names one platform as the
 * answer to a question, so its honesty is tested here twice over: once as
 * decision rules (which column each answer selects, and what happens when the
 * data to answer does not exist) and once as copy (no dash, no «بهترین», and
 * every missing value spelled out as a sentence). The proof that the rules are
 * blind to who pays us lives in `ranking-neutrality.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CALC_REQUIRED_INPUTS,
  CALC_TOOLS,
  CALC_TOOL_WIZARD,
  isCalcCompleted,
  isCalcStarted,
} from "../src/lib/calc-events";
import { formatPercentPointsFa, formatToman } from "../src/lib/format";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { fetchRowsForPlatforms } from "../src/lib/rows";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, STATIC_PAGE_SLUGS } from "../src/lib/slugs";
import { resolveSlug } from "../src/lib/slugs";
import { TOOLS } from "../src/lib/tools";
import {
  buildWizardResult,
  noCriterionFa,
  noSpreadFa,
  undeclaredSetAsideFa,
  WIZARD_BELOW_MINIMUM_FA,
  WIZARD_COMMISSION_FA,
  WIZARD_NEUTRALITY_FA,
  WIZARD_NO_DELIVERY_FA,
  WIZARD_NO_PRICE_FA,
  WIZARD_PATH,
  WIZARD_TIE_FA,
  wizardSearchOf,
  type WizardAnswered,
  type WizardSearch,
} from "../src/lib/wizard";
import { assembleWizardData, type WizardPageData } from "../src/lib/wizard-data";
import { WizardPage, wizardHead } from "../src/routes/kodam-saku";
import { freshIso, makeListing, makeSnapshot, seed, type SeededStore } from "./support/seed";

const SLUGS = ["wallgold", "talasea", "milli", "digikala"] as const;
type Slug = (typeof SLUGS)[number];

const PRICES: Readonly<Record<Slug, number>> = {
  wallgold: 18_611_000,
  talasea: 18_530_000,
  milli: 18_800_000,
  digikala: 18_520_000,
};

interface Terms {
  buy: string | null;
  sell: string | null;
  roundTrip: string | null;
}

const TERMS: Readonly<Record<Slug, Terms>> = {
  wallgold: { buy: "0.3", sell: "0.9", roundTrip: "1.2" },
  talasea: { buy: "0.7", sell: "0.2", roundTrip: "0.9" },
  milli: { buy: "0.5", sell: "0.5", roundTrip: "1.6" },
  digikala: { buy: null, sell: null, roundTrip: null },
};

const NAMES_FA: Readonly<Record<Slug, string>> = {
  wallgold: "وال‌گلد",
  talasea: "طلاسی",
  milli: "میلی",
  digikala: "دیجی‌کالا",
};

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: [...SLUGS],
  published: true,
  purity: "750",
});

interface StoreOptions {
  deliveryOn?: readonly Slug[];
  minimums?: Partial<Record<Slug, number>>;
  terms?: Partial<Record<Slug, Terms>>;
  prices?: Partial<Record<Slug, number | null>>;
}

function platformOf(slug: Slug, options: StoreOptions): ListedPlatform {
  const minimum = options.minimums?.[slug];
  return {
    slug,
    name_fa: NAMES_FA[slug],
    data_policy: "ALLOWED",
    website_url: `https://${slug}.example`,
    ...((options.deliveryOn ?? []).includes(slug)
      ? { delivery_note_fa: "تحویل فیزیکی با هماهنگی قبلی" }
      : {}),
    ...(minimum === undefined
      ? {}
      : {
          profile: {
            payment_methods: [],
            kyc_level: null,
            mobile_app: null,
            delivery_cost_fa: null,
            min_buy_toman: minimum,
            min_sell_toman: null,
            pros_fa: [],
            cons_fa: [],
            faq: [],
          },
        }),
  };
}

function storeOf(options: StoreOptions = {}): SeededStore {
  const now = freshIso();
  const snapshots: SeededStore["snapshots"] = {};
  const updatedAt: SeededStore["updatedAt"] = {};
  for (const slug of SLUGS) {
    const override = options.prices?.[slug];
    const price = override === undefined ? PRICES[slug] : override;
    const terms = options.terms?.[slug] ?? TERMS[slug];
    updatedAt[slug] = now;
    if (price === null) {
      snapshots[slug] = null;
      continue;
    }
    snapshots[slug] =
      terms.buy === null && terms.sell === null && terms.roundTrip === null
        ? makeSnapshot({ slug, mid: price, fetchedAt: now, feeSource: "UNKNOWN" })
        : makeSnapshot({
            slug,
            mid: price,
            fetchedAt: now,
            ...(terms.buy === null ? {} : { buyFee: terms.buy }),
            ...(terms.sell === null ? {} : { sellFee: terms.sell }),
            ...(terms.roundTrip === null ? {} : { roundTrip: terms.roundTrip }),
          });
  }
  return {
    listed: SLUGS.map((slug) => platformOf(slug, options)),
    instruments: [TALA18],
    snapshots,
    updatedAt,
  };
}

async function wizardData(options: StoreOptions = {}): Promise<WizardPageData> {
  seed(storeOf(options));
  return assembleWizardData({ resolveSlug, fetchRowsForPlatforms });
}

async function answered(search: WizardSearch, options: StoreOptions = {}) {
  const data = await wizardData(options);
  const result = buildWizardResult({
    rows: data.rows,
    instrument: "GOLD_18K",
    nowMs: Date.parse(data.generated_at),
    search,
    tablePath: "/tala-18",
  });
  if (result.kind !== "answered") throw new Error("the wizard treated the answers as incomplete");
  return result;
}

function leaders(result: WizardAnswered): string[] {
  if (result.outcome.kind !== "match") {
    throw new Error(`expected a recommendation, got: ${result.outcome.reasonFa}`);
  }
  return result.outcome.leaders.map((candidate) => candidate.slug);
}

function ordered(result: WizardAnswered): string[] {
  if (result.outcome.kind !== "match") {
    throw new Error(`expected a recommendation, got: ${result.outcome.reasonFa}`);
  }
  return [...result.outcome.leaders, ...result.outcome.alternatives].map(
    (candidate) => candidate.slug,
  );
}

const TEN_MILLION: WizardSearch = { amount: 10_000_000 };

async function renderWizard(search: WizardSearch, options: StoreOptions = {}): Promise<string> {
  const data = await wizardData(options);
  return renderToStaticMarkup(<WizardPage data={data} search={search} />);
}

describe("the wizard turns each answer into one already-published column", () => {
  it("«می‌خواهم زود بفروشم» selects the round-trip column and names its cheapest platform", async () => {
    const result = await answered({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(result.criterion).toBe("round-trip");
    expect(leaders(result)).toEqual(["talasea"]);
    expect(ordered(result)).toEqual(["talasea", "wallgold", "milli"]);
  });

  it("«فروش کوتاه‌مدت ندارم» selects the buy-fee column instead, and the answer changes", async () => {
    const result = await answered({ ...TEN_MILLION, delivery: "no", resale: "no" });
    expect(result.criterion).toBe("buy-fee");
    expect(leaders(result)).toEqual(["wallgold"]);
    expect(ordered(result)).toEqual(["wallgold", "milli", "talasea"]);
  });

  it("a platform that published no fee is never recommended, however cheap its price is", async () => {
    for (const resale of ["yes", "no"] as const) {
      const result = await answered({ ...TEN_MILLION, delivery: "no", resale });
      expect(ordered(result), resale).not.toContain("digikala");
    }
  });

  it("the reason is written in the reader's terms, not as a bare verdict", async () => {
    const result = await answered({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(result.criterionReasonFa).toContain("هزینه‌ی رفت‌وبرگشت");
    expect(result.leadReasonFa).toContain("کم‌ترین هزینه‌ی رفت‌وبرگشت");
    expect(result.criterionReasonFa).not.toContain("بهترین");
  });

  it("the amount turns the published percentage into toman without touching the order", async () => {
    const small = await answered({ amount: 10_000_000, delivery: "no", resale: "yes" });
    const large = await answered({ amount: 500_000_000, delivery: "no", resale: "yes" });
    expect(ordered(small)).toEqual(ordered(large));
    if (small.outcome.kind !== "match" || large.outcome.kind !== "match")
      throw new Error("no match");
    expect(small.outcome.leaders[0]?.feeToman).toBe(90_000);
    expect(large.outcome.leaders[0]?.feeToman).toBe(4_500_000);
  });

  it("a minimum we do know excludes the platform; a minimum we don't know never does", async () => {
    const options: StoreOptions = { minimums: { milli: 50_000_000 } };
    const belowMilli = await answered({ amount: 1_000_000, delivery: "no", resale: "no" }, options);
    expect(ordered(belowMilli)).toEqual(["wallgold", "talasea"]);
    const aboveMilli = await answered(
      { amount: 60_000_000, delivery: "no", resale: "no" },
      options,
    );
    expect(ordered(aboveMilli)).toEqual(["wallgold", "milli", "talasea"]);
    expect(belowMilli.notes.some((note) => note.includes("حداقل خرید"))).toBe(true);
  });

  it("ties are shown as ties instead of being broken silently", async () => {
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "yes" },
      { terms: { milli: { buy: "0.5", sell: "0.5", roundTrip: "0.9" } } },
    );
    expect(leaders(result).sort()).toEqual(["milli", "talasea"]);
  });
});

describe("physical delivery: the answer is only as wide as the data behind it", () => {
  it("with delivery asked for, only platforms we verified are eligible", async () => {
    const result = await answered(
      { ...TEN_MILLION, delivery: "yes", resale: "no" },
      { deliveryOn: ["talasea", "digikala"] },
    );
    expect(ordered(result)).toEqual(["talasea"]);
    expect(result.notes.some((note) => note.includes("بررسی نکرده‌ایم"))).toBe(true);
  });

  /**
   * ⚠️ The whole point of this case: `delivery_note_fa` is filled for three of
   * the fourteen platforms in the registry, so a delivery filter over a live
   * payload that has none of them would quietly be dropped by
   * `buildComparisonModel` and the wizard would answer a question nobody asked.
   * It must refuse instead.
   */
  it("with nothing verified, the wizard refuses rather than recommending the least-bad row", async () => {
    const result = await answered({ ...TEN_MILLION, delivery: "yes", resale: "no" });
    expect(result.outcome).toEqual({ kind: "none", reasonFa: WIZARD_NO_DELIVERY_FA });
    expect(WIZARD_NO_DELIVERY_FA).toContain("تأیید نکرده‌ایم");
    // Scoped to what we actually looked at: the platforms we can price today.
    expect(WIZARD_NO_DELIVERY_FA).toContain("میان سکوهایی که همین حالا قیمت دارند");
  });

  /**
   * ⚠️ The mirror case, and a regression the "a filter that excludes nobody is
   * disabled" rule can cause: when *every* priced platform has a confirmed
   * delivery note, `buildComparisonModel` drops the delivery filter because it
   * hides nobody. Reading the wizard's delivery constraint off that control's
   * `available` would then refuse a question every candidate satisfies.
   */
  it("with delivery verified everywhere, the filter goes quiet and the wizard still answers", async () => {
    const result = await answered(
      { ...TEN_MILLION, delivery: "yes", resale: "no" },
      { deliveryOn: [...SLUGS] },
    );
    expect(leaders(result)).toEqual(["wallgold"]);
  });

  it("the delivery terms travel with the recommendation instead of staying a yes/no", async () => {
    const html = await renderWizard(
      { ...TEN_MILLION, delivery: "yes", resale: "no" },
      { deliveryOn: ["talasea", "wallgold"] },
    );
    expect(html).toContain("data-wizard-delivery-note");
    expect(html).toContain("تحویل فیزیکی با هماهنگی قبلی");
  });

  it("saying no to delivery excludes nobody, and the page says so", async () => {
    const withDelivery = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "no" },
      { deliveryOn: ["talasea"] },
    );
    expect(ordered(withDelivery)).toEqual(["wallgold", "milli", "talasea"]);
    expect(withDelivery.notes.some((note) => note.includes("کنار گذاشته نشد"))).toBe(true);
  });
});

describe("when no platform genuinely fits, the wizard says so", () => {
  it("no price anywhere ⟸ no recommendation", async () => {
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "no" },
      { prices: { wallgold: null, talasea: null, milli: null, digikala: null } },
    );
    expect(result.outcome).toEqual({ kind: "none", reasonFa: WIZARD_NO_PRICE_FA });
  });

  /**
   * ⚠️ A real outage is not `rows: []`. It is every platform still listed —
   * the registry is compiled into the bundle, delivery notes and all — with
   * every snapshot gone. In that shape the true cause is "we cannot read a
   * price", and answering «بله» to physical delivery used to be told instead
   * that we had never checked delivery anywhere, which is a false claim about
   * our own diligence and contradicts what `/talasea` renders in the same
   * second. The no-price guard has to run first.
   */
  it("a price outage says so, even when the answer asked for physical delivery", async () => {
    const blank = { wallgold: null, talasea: null, milli: null, digikala: null } as const;
    for (const delivery of ["yes", "no"] as const) {
      const result = await answered(
        { ...TEN_MILLION, delivery, resale: "no" },
        { prices: blank, deliveryOn: ["talasea", "milli"] },
      );
      expect(result.outcome, delivery).toEqual({ kind: "none", reasonFa: WIZARD_NO_PRICE_FA });
    }
  });

  it("nobody published the selected column ⟸ no recommendation, and the column is named", async () => {
    const blank: Terms = { buy: null, sell: null, roundTrip: null };
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "yes" },
      { terms: { wallgold: blank, talasea: blank, milli: blank } },
    );
    expect(result.outcome).toEqual({
      kind: "none",
      reasonFa: noCriterionFa("round-trip"),
    });
  });

  it("every known minimum above the amount ⟸ no recommendation", async () => {
    const result = await answered(
      { amount: 100_000, delivery: "no", resale: "no" },
      {
        minimums: {
          wallgold: 5_000_000,
          talasea: 5_000_000,
          milli: 5_000_000,
          digikala: 5_000_000,
        },
      },
    );
    expect(result.outcome).toEqual({ kind: "none", reasonFa: WIZARD_BELOW_MINIMUM_FA });
  });

  /**
   * ⚠️ This is what the live payload actually looks like today: thirteen
   * platforms publishing the identical `round_trip_percent`. Before this rule
   * the wizard "recommended" all thirteen at once, which is a list wearing the
   * costume of an answer.
   */
  it("a criterion everybody declared identically separates nobody, and is reported as such", async () => {
    const same: Terms = { buy: "0.5", sell: "0.5", roundTrip: "0.995" };
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "yes" },
      { terms: { wallgold: same, talasea: same, milli: same } },
    );
    expect(result.outcome).toEqual({ kind: "none", reasonFa: noSpreadFa(3, "round-trip") });
    expect(noSpreadFa(3, "round-trip")).toContain("هزینه‌ی رفت‌وبرگشت");
  });

  it("an unanswered question is reported as unanswered, never as a recommendation", async () => {
    const data = await wizardData();
    const partial: WizardSearch[] = [{}, { amount: 10_000_000 }, { delivery: "yes", resale: "no" }];
    for (const search of partial) {
      const result = buildWizardResult({
        rows: data.rows,
        instrument: "GOLD_18K",
        nowMs: Date.parse(data.generated_at),
        search,
        tablePath: "/tala-18",
      });
      expect(result.kind, JSON.stringify(search)).toBe("unanswered");
    }
  });
});

describe("the answer is auditable — it points back at the same view of the table", () => {
  it("the table link carries the same sort, and the same filter when delivery was asked for", async () => {
    const plain = await answered({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(plain.tableHref).toBe("/tala-18?sort=round-trip");
    const delivered = await answered(
      { ...TEN_MILLION, delivery: "yes", resale: "no" },
      { deliveryOn: ["talasea"] },
    );
    expect(delivered.tableHref).toBe("/tala-18?sort=buy-fee&filter=delivery");
  });

  it("the amount reaches one canonical query string whichever digits were typed", () => {
    expect(wizardSearchOf({ amount: "۱۰٬۰۰۰٬۰۰۰", delivery: "yes", resale: "no" })).toEqual({
      amount: 10_000_000,
      delivery: "yes",
      resale: "no",
    });
    expect(wizardSearchOf({ amount: "not a number", delivery: "maybe" })).toEqual({});
  });
});

describe("the rendered page", () => {
  it("works without JavaScript: a GET form whose controls are real inputs", async () => {
    const html = await renderWizard({});
    expect(html).toContain('method="get"');
    expect(html).toContain(`action="${WIZARD_PATH}"`);
    expect(html).toContain('name="amount"');
    expect(html).toContain('data-wizard-choice="delivery:yes"');
    expect(html).toContain('data-wizard-choice="resale:no"');
    expect(html).toContain("data-wizard-submit");
  });

  it("renders the recommendation, its number and its reason", async () => {
    const html = await renderWizard({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(html).toContain('data-wizard-outcome="match"');
    expect(html).toContain('data-wizard-leader="talasea"');
    expect(html).toContain('data-wizard-alternative="wallgold"');
    expect(html).toContain(formatPercentPointsFa(0.9));
    expect(html).toContain(formatToman(90_000));
    expect(html).toContain("کم‌ترین هزینه‌ی رفت‌وبرگشت");
  });

  it("the leader gets a /go/ exit, never a bare link to the platform's domain", async () => {
    const html = await renderWizard({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(html).toContain('href="/go/talasea"');
    expect(html).not.toContain("talasea.example");
  });

  it("prints the neutrality claim and the honesty notes, and never a dash for a missing value", async () => {
    const html = await renderWizard({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(html).toContain(WIZARD_NEUTRALITY_FA);
    expect(html).toContain("data-wizard-note");
    expect(html).not.toContain("—");
    expect(html).not.toContain("نامشخص");
    expect(html).not.toContain("بهترین");
  });

  /**
   * ⚠️ The page names a platform and puts a `/go/` button under it, and that
   * button is where Tablo earns. Denying an «قرارداد تبلیغاتی» — something
   * Tablo does not have — while never mentioning the commission it does have
   * is a narrower claim than the reader needs at exactly the point of
   * monetization. The word is «کمیسیون», and the disclosure ships with it.
   */
  it("names the actual commercial relationship next to the exit button", async () => {
    const html = await renderWizard({ ...TEN_MILLION, delivery: "no", resale: "yes" });
    expect(html).toContain('href="/go/talasea"');
    expect(html).toContain("data-wizard-commission");
    expect(html).toContain(WIZARD_COMMISSION_FA);
    expect(WIZARD_NEUTRALITY_FA).toContain("کمیسیون");
    expect(WIZARD_COMMISSION_FA).toContain("کمیسیون");
    expect(html).not.toContain("قرارداد تبلیغاتی");
  });

  /**
   * ⚠️ Every other exclusion the wizard makes is reported with a count under
   * «چه چیزی را نمی‌داند». The largest one — platforms dropped because they
   * published nothing in the selected column — used to be silent, so the page
   * could name a winner «میان سکوهای باقی‌مانده» without ever saying how many
   * candidates the silence removed.
   */
  it("counts the platforms dropped for not declaring the selected column", async () => {
    const blank: Terms = { buy: null, sell: null, roundTrip: null };
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "no" },
      { terms: { milli: blank, talasea: blank } },
    );
    // milli and talasea here, plus digikala which declares nothing anyway.
    expect(leaders(result)).toEqual(["wallgold"]);
    expect(result.notes).toContain(undeclaredSetAsideFa(3, "buy-fee"));
    expect(undeclaredSetAsideFa(3, "buy-fee")).toContain("کارمزد خرید");
  });

  it("says nothing about undeclared columns when every candidate declared one", async () => {
    const result = await answered(
      { ...TEN_MILLION, delivery: "no", resale: "no" },
      { terms: { digikala: { buy: "0.4", sell: "0.4", roundTrip: "0.8" } } },
    );
    expect(leaders(result)).toEqual(["wallgold"]);
    expect(result.notes.some((note) => note.includes("سکوت یک سکو"))).toBe(false);
  });

  it("a refusal is rendered as a sentence, with no platform named as a consolation", async () => {
    const html = await renderWizard({ ...TEN_MILLION, delivery: "yes", resale: "no" });
    expect(html).toContain('data-wizard-outcome="none"');
    expect(html).toContain(WIZARD_NO_DELIVERY_FA);
    expect(html).not.toContain("data-wizard-leader");
    expect(html).not.toContain('href="/go/');
  });

  it("shows the tie sentence when two platforms declared the same number", async () => {
    const html = await renderWizard(
      { ...TEN_MILLION, delivery: "no", resale: "yes" },
      { terms: { milli: { buy: "0.5", sell: "0.5", roundTrip: "0.9" } } },
    );
    expect(html).toContain(WIZARD_TIE_FA);
    expect(html).toContain('data-wizard-leader="milli"');
    expect(html).toContain('data-wizard-leader="talasea"');
  });

  it("a page nobody has answered yet shows the form and no verdict", async () => {
    const html = await renderWizard({});
    expect(html).not.toContain("data-wizard-result");
    expect(html).not.toContain("data-wizard-leader");
  });

  it("survives an outage as an empty answer, not as a throw", async () => {
    const data: WizardPageData = {
      listing: null,
      rows: [],
      generated_at: new Date().toISOString(),
    };
    const html = renderToStaticMarkup(
      <WizardPage data={data} search={{ ...TEN_MILLION, delivery: "no", resale: "no" }} />,
    );
    expect(html).toContain(WIZARD_NO_PRICE_FA);
  });
});

describe("the wizard is a first-class page", () => {
  it("its slug is reserved, so no platform can shadow it", () => {
    expect(STATIC_PAGE_SLUGS.has("kodam-saku")).toBe(true);
    expect(isReservedSlug("kodam-saku")).toBe(true);
  });

  it("it is in the tools registry, the sitemap, and canonicalizes without the answers", () => {
    expect(TOOLS.map((tool) => tool.href)).toContain(WIZARD_PATH);
    expect(
      buildSitemapEntries({ posts: [], instruments: [], platforms: [] }).map((entry) => entry.path),
    ).toContain(WIZARD_PATH);
    expect(wizardHead().links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}${WIZARD_PATH}`,
    });
  });
});

/**
 * ⚠️ A completed wizard run is the closest thing the site has to the
 * north-star metric — a decision the visitor actually reached — so it is
 * counted with the same beacon as the calculators. What is *not* counted is a
 * run that ended in «سکویی پیشنهاد نمی‌کنیم»: that is an honest answer, but
 * counting it would let our own data gaps read as completed decisions.
 */
describe("beacons: a finished wizard run counts as a completed decision", () => {
  it("the wizard is a registered calc tool whose only numeric input is the amount", () => {
    expect(CALC_TOOLS).toContain(CALC_TOOL_WIZARD);
    expect(CALC_REQUIRED_INPUTS[CALC_TOOL_WIZARD]).toEqual(["amount"]);
  });

  it("answering anything starts it; only a real recommendation completes it", () => {
    const initial = { amount: "", delivery: "", resale: "" };
    expect(isCalcStarted(initial, initial)).toBe(false);
    expect(isCalcStarted(initial, { ...initial, delivery: "yes" })).toBe(true);

    const values = { amount: "10000000", delivery: "no", resale: "yes" };
    expect(isCalcCompleted(CALC_TOOL_WIZARD, values, true)).toBe(true);
    expect(isCalcCompleted(CALC_TOOL_WIZARD, values, false)).toBe(false);
    expect(isCalcCompleted(CALC_TOOL_WIZARD, { ...values, amount: "" }, true)).toBe(false);
  });
});
