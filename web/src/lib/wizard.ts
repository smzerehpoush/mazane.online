/**
 * ⚠️ This module names one platform out loud, which makes it the surface where
 * a commission would do the most damage. It reads exactly two things: numbers
 * the platforms published about themselves, and the three answers the visitor
 * gave. No monetization field may ever be read here, not even to break a tie —
 * `tests/ranking-neutrality.test.tsx` replays every answer combination against
 * stores that differ in nothing but who pays us, and `tests/sponsored-links.test.tsx`
 * greps this file at the source level for the names of those fields.
 *
 * ⚠️ The wizard never invents a score. Each answer picks **one already-published
 * column** and the recommendation is the smallest number in it. Multiplying the
 * quoted price by a fee to rank on a "real" cost is forbidden by the rule at the
 * top of `lib/rows.ts`, and a weighted blend of two columns would be a number no
 * platform ever published.
 */
import { parseCalculatorInput } from "./calculator";
import {
  buildComparisonModel,
  comparisonHref,
  hasConfirmedDelivery,
  metricOf,
  minOrderToman,
  type ComparisonFilter,
} from "./comparison-table";
import { formatFaNumber } from "./fa-number";
import type { Row } from "./rows";

export const WIZARD_PATH = "/kodam-saku";

export const WIZARD_ASSET_SLUG = "tala-18";

export const WIZARD_QUESTIONS = ["amount", "delivery", "resale"] as const;
export type WizardQuestion = (typeof WIZARD_QUESTIONS)[number];

export const YES_NO = ["yes", "no"] as const;
export type YesNo = (typeof YES_NO)[number];

export type WizardCriterion = "round-trip" | "buy-fee";

/**
 * ⚠️ `amount` is a **number**, not the raw string the visitor typed. The
 * router's search serializer quotes a string that would otherwise parse as a
 * number, so `?amount=10000000` and `?amount="10000000"` would be two URLs for
 * one page, and every plain link into the wizard would cost a redirect.
 */
export interface WizardSearch {
  amount?: number;
  delivery?: YesNo;
  resale?: YesNo;
}

export const WIZARD_QUESTION_LABELS_FA: Record<WizardQuestion, string> = {
  amount: "چه مبلغی می‌خواهید بخرید؟",
  delivery: "تحویل فیزیکی طلا می‌خواهید؟",
  resale: "قصد فروش کوتاه‌مدت دارید؟",
};

export const WIZARD_QUESTION_HINTS_FA: Record<WizardQuestion, string> = {
  amount:
    "مبلغ را به تومان بنویسید. همین عدد است که حداقل خرید سکوها را می‌سنجد و درصد کارمزد را برایتان به تومان برمی‌گرداند.",
  delivery: "یعنی طلا را به‌صورت فیزیکی تحویل بگیرید، نه اینکه فقط در حساب سکو نگه دارید.",
  resale: "اگر ممکن است در همین هفته‌ها بفروشید، جواب بله است.",
};

export const WIZARD_MISSING_FA: Record<WizardQuestion, string> = {
  amount: "مبلغ خرید را به تومان بنویسید.",
  delivery: "به پرسش تحویل فیزیکی جواب بدهید.",
  resale: "به پرسش فروش کوتاه‌مدت جواب بدهید.",
};

export const WIZARD_CRITERION_LABELS_FA: Record<WizardCriterion, string> = {
  "round-trip": "هزینه‌ی رفت‌وبرگشت",
  "buy-fee": "کارمزد خرید",
};

export const WIZARD_CRITERION_REASONS_FA: Record<WizardCriterion, string> = {
  "round-trip":
    "گفتید ممکن است زود بفروشید، پس معیار ما هزینه‌ی رفت‌وبرگشت است: اثر کارمزد خرید و کارمزد فروش با هم، چون هر دو را می‌پردازید.",
  "buy-fee":
    "گفتید قصد فروش کوتاه‌مدت ندارید، پس معیار ما کارمزد خرید است: تنها کارمزدی که همین امروز قطعی می‌پردازید. کارمزد فروش تا روزی که بفروشید می‌تواند عوض شود.",
};

export const WIZARD_LEAD_REASONS_FA: Record<WizardCriterion, string> = {
  "round-trip": "کم‌ترین هزینه‌ی رفت‌وبرگشت اعلام‌شده میان سکوهای باقی‌مانده",
  "buy-fee": "کم‌ترین کارمزد خرید اعلام‌شده میان سکوهای باقی‌مانده",
};

export const WIZARD_NO_PRICE_FA =
  "همین حالا از هیچ سکویی قیمتی در دست نداریم، پس چیزی برای مقایسه نمانده است.";

export const WIZARD_NO_DELIVERY_FA =
  "میان سکوهایی که همین حالا قیمت دارند، تحویل فیزیکی هیچ‌کدام را هنوز بررسی و تأیید نکرده‌ایم، پس برای این خواسته سکویی پیشنهاد نمی‌کنیم.";

export const WIZARD_BELOW_MINIMUM_FA =
  "حداقل خرید هر سکویی که عددش را داریم از این مبلغ بیشتر است، پس با این مبلغ سکویی نمی‌ماند.";

export const WIZARD_AMOUNT_NOTE_FA =
  "مبلغ خرید ترتیب این فهرست را عوض نمی‌کند، چون کارمزدها درصدی‌اند و درصد با مبلغ تغییر نمی‌کند. مبلغ دو کار می‌کند: سکویی را که حداقل خریدش از آن بیشتر است کنار می‌گذارد و همان درصد را برای مبلغ شما به تومان برمی‌گرداند.";

export const WIZARD_ROUND_TRIP_APPROX_FA =
  "عدد تومانی رفت‌وبرگشت تقریبی است: کارمزد فروش روی مبلغ روز فروش حساب می‌شود، نه روی مبلغی که امروز می‌پردازید.";

export const WIZARD_DELIVERY_OFF_FA =
  "چون تحویل فیزیکی نخواستید، هیچ سکویی به‌خاطر تحویل کنار گذاشته نشد.";

export const WIZARD_STALENESS_FA =
  "هیچ سکویی به‌خاطر قدیمی‌بودن آخرین قیمتش کنار گذاشته نشد؛ کارمزد در شرایط خود سکو نوشته می‌شود و با تأخیر جمع‌آوری قیمت عوض نمی‌شود.";

/**
 * ⚠️ «قرارداد تبلیغاتی» is not what Tablo has and denying it is a narrower
 * claim than the one the reader needs: the money is affiliate commission, and
 * the `/go/` button sitting right above this sentence is what earns it. The
 * word here must stay «کمیسیون», the same word `/about` uses, and the
 * disclosure below it must stay on the page next to that button.
 */
export const WIZARD_NEUTRALITY_FA =
  "کمیسیون در این پیشنهاد اثری ندارد. معیار همان عددی است که خود سکو اعلام کرده و تابلو فقط کم‌ترینش را نشان می‌دهد.";

export const WIZARD_COMMISSION_FA =
  "تابلو از لینک‌های معرفی درآمد دارد: اگر از دکمه‌ی خروجی همین صفحه وارد سایت یک سکو شوید و آنجا ثبت‌نام یا خرید کنید، برای بخشی از سکوها به تابلو کمیسیون می‌رسد. این پیشنهاد پیش از آنکه معلوم شود کدام سکو کمیسیون می‌دهد ساخته می‌شود.";

/**
 * ⚠️ On the live payload almost every platform publishes the same
 * `round_trip_percent`, so without this rule the «پیشنهاد» was thirteen
 * platforms at once — a list dressed up as an answer. When the selected column
 * does not separate the candidates, the honest output is that it does not, not
 * a winner picked by a tie-break the reader cannot see.
 */
export const MAX_WIZARD_LEADERS = 3;

export function noSpreadFa(count: number, criterion: WizardCriterion): string {
  return `${formatFaNumber(count)} سکو دقیقاً یک عدد برای ${WIZARD_CRITERION_LABELS_FA[criterion]} اعلام کرده‌اند، پس این معیار میانشان فرقی نمی‌گذارد و ما هیچ‌کدام را جلوی بقیه نمی‌گذاریم.`;
}

export const WIZARD_TIE_FA =
  "این سکوها در معیار انتخابی عدد یکسانی اعلام کرده‌اند و ما هیچ‌کدام را بر دیگری ترجیح نمی‌دهیم.";

export function noCriterionFa(criterion: WizardCriterion): string {
  return `هیچ‌کدام از سکوهای باقی‌مانده ${WIZARD_CRITERION_LABELS_FA[criterion]} خود را عمومی اعلام نکرده است، پس در این معیار عددی برای مقایسه نداریم.`;
}

export function unknownMinimumFa(count: number): string {
  return `حداقل خرید ${formatFaNumber(count)} سکو را هنوز جمع نکرده‌ایم؛ ممکن است مبلغ شما از حداقلشان کمتر باشد و ما ندانیم.`;
}

export function minimumSetAsideFa(count: number): string {
  return `${formatFaNumber(count)} سکو کنار گذاشته شد، چون حداقل خرید اعلامی‌شان از مبلغ شما بیشتر است.`;
}

export function deliverySetAsideFa(count: number): string {
  return `${formatFaNumber(count)} سکو کنار گذاشته شد، چون تحویل فیزیکی‌شان را بررسی نکرده‌ایم؛ یعنی ما نمی‌دانیم، نه اینکه تحویل نمی‌دهند.`;
}

export function unpricedSetAsideFa(count: number): string {
  return `${formatFaNumber(count)} سکو در این پیشنهاد نیامد، چون همین حالا قیمتی از آن‌ها نداریم.`;
}

export function undeclaredSetAsideFa(count: number, criterion: WizardCriterion): string {
  return `${formatFaNumber(count)} سکو کنار گذاشته شد، چون ${WIZARD_CRITERION_LABELS_FA[criterion]} خود را عمومی اعلام نکرده است؛ سکوت یک سکو به‌جای ارزانی خوانده نمی‌شود.`;
}

export function asYesNo(value: unknown): YesNo | null {
  return typeof value === "string" && (YES_NO as readonly string[]).includes(value)
    ? (value as YesNo)
    : null;
}

export function amountFromInput(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }
  if (typeof value !== "string") return null;
  const parsed = parseCalculatorInput(value);
  return parsed === null ? null : Math.round(parsed);
}

/**
 * ⚠️ Persian digits are folded into the same number the Latin ones give, so
 * `?amount=۱۰۰۰۰۰۰۰` and `?amount=10000000` are one page, not two.
 */
export function wizardSearchOf(input: {
  amount?: unknown;
  delivery?: unknown;
  resale?: unknown;
}): WizardSearch {
  const amount = amountFromInput(input.amount ?? null);
  const delivery = asYesNo(input.delivery);
  const resale = asYesNo(input.resale);
  return {
    ...(amount === null ? {} : { amount }),
    ...(delivery === null ? {} : { delivery }),
    ...(resale === null ? {} : { resale }),
  };
}

export function criterionFor(resale: YesNo): WizardCriterion {
  return resale === "yes" ? "round-trip" : "buy-fee";
}

export interface WizardCandidate {
  slug: string;
  nameFa: string;
  percent: number;
  feeToman: number;
  updatedAt: string | null;
  deliveryNoteFa: string | null;
  outbound: boolean;
}

export const WIZARD_DELIVERY_TERMS_PREFIX_FA = "شرط تحویل فیزیکی که از این سکو ثبت کرده‌ایم:";

export type WizardOutcome =
  | { kind: "match"; leaders: readonly WizardCandidate[]; alternatives: readonly WizardCandidate[] }
  | { kind: "none"; reasonFa: string };

export interface WizardAnswered {
  kind: "answered";
  amountToman: number;
  delivery: YesNo;
  resale: YesNo;
  criterion: WizardCriterion;
  criterionLabelFa: string;
  criterionReasonFa: string;
  leadReasonFa: string;
  outcome: WizardOutcome;
  notes: readonly string[];
  tableHref: string;
}

export interface WizardUnanswered {
  kind: "unanswered";
  missing: readonly WizardQuestion[];
}

export type WizardResult = WizardAnswered | WizardUnanswered;

export const MAX_WIZARD_ALTERNATIVES = 3;

function candidateOf(row: Row, percent: number, amountToman: number): WizardCandidate {
  return {
    slug: row.platform.slug,
    nameFa: row.platform.name_fa,
    percent,
    feeToman: Math.round((amountToman * percent) / 100),
    updatedAt: row.updatedAt,
    deliveryNoteFa: row.platform.delivery_note_fa ?? null,
    outbound: (row.platform.website_url ?? null) !== null,
  };
}

export interface WizardInput {
  rows: readonly Row[];
  instrument: string;
  nowMs: number;
  search: WizardSearch;
  tablePath: string;
}

/**
 * ⚠️ Two guards here look redundant and are not. `buildComparisonModel` drops a
 * sort or a filter it cannot honour and silently falls back to the price order,
 * which is right for a table the reader is looking at and wrong for a wizard:
 * answering «تحویل فیزیکی می‌خواهم» and being handed a platform whose delivery
 * we never checked is a different question than the one that was asked. So a
 * delivery constraint nothing satisfies and an undisclosed criterion both end
 * in an explicit "we cannot answer this", never in a fallback ranking.
 *
 * ⚠️ The refusals are ordered by cause, cheapest true statement first. During a
 * store outage every one of them is technically reachable, and «تحویل فیزیکی
 * هیچ‌کدام را بررسی نکرده‌ایم» would then be a false claim about our own
 * diligence when the true cause is that we cannot read any price. The no-price
 * guard therefore runs before the delivery guard, not after.
 *
 * ⚠️ The delivery constraint is answered from the rows, not from the filter
 * control's `available`: a filter is also unavailable when it excludes nobody,
 * and a table where *every* platform has a confirmed delivery note must end in
 * a recommendation, not in a refusal.
 *
 * ⚠️ A minimum we have not collected never excludes anybody. The profile table
 * is empty for almost every platform, so treating "unknown" as "too expensive"
 * would empty the page and read as «هیچ سکویی مناسب نیست» — a claim about the
 * platforms rather than about our own gap.
 */
export function buildWizardResult({
  rows,
  instrument,
  nowMs,
  search,
  tablePath,
}: WizardInput): WizardResult {
  const amountToman = amountFromInput(search.amount ?? null);
  const delivery = asYesNo(search.delivery);
  const resale = asYesNo(search.resale);

  const missing = WIZARD_QUESTIONS.filter(
    (question) =>
      (question === "amount" && amountToman === null) ||
      (question === "delivery" && delivery === null) ||
      (question === "resale" && resale === null),
  );
  if (amountToman === null || delivery === null || resale === null) {
    return { kind: "unanswered", missing };
  }

  const criterion = criterionFor(resale);
  const filters: ComparisonFilter[] = delivery === "yes" ? ["delivery"] : [];
  const model = buildComparisonModel({
    rows,
    instrument,
    nowMs,
    view: { sort: criterion, filters },
  });
  const tableHref = comparisonHref({ sort: criterion, filters: model.filters }, tablePath);

  const deliveryPossible = model.visible.some(hasConfirmedDelivery);
  const withinMinimum = model.visible.filter((row) => {
    const minimum = minOrderToman(row);
    return minimum === null || minimum <= amountToman;
  });
  const unknownMinimum = withinMinimum.filter((row) => minOrderToman(row) === null).length;

  const ranked: WizardCandidate[] = [];
  let undeclared = 0;
  for (const row of withinMinimum) {
    const percent = metricOf(row, criterion, instrument);
    if (percent === null) undeclared += 1;
    else ranked.push(candidateOf(row, percent, amountToman));
  }

  const notes: string[] = [WIZARD_AMOUNT_NOTE_FA];
  if (criterion === "round-trip") notes.push(WIZARD_ROUND_TRIP_APPROX_FA);
  if (delivery === "yes") {
    if (model.hiddenCount > 0) notes.push(deliverySetAsideFa(model.hiddenCount));
  } else {
    notes.push(WIZARD_DELIVERY_OFF_FA);
  }
  const minimumSetAside = model.visible.length - withinMinimum.length;
  if (minimumSetAside > 0) notes.push(minimumSetAsideFa(minimumSetAside));
  if (unknownMinimum > 0) notes.push(unknownMinimumFa(unknownMinimum));
  if (undeclared > 0) notes.push(undeclaredSetAsideFa(undeclared, criterion));
  if (model.unpriced.length > 0) notes.push(unpricedSetAsideFa(model.unpriced.length));
  notes.push(WIZARD_STALENESS_FA);

  const answered = {
    kind: "answered",
    amountToman,
    delivery,
    resale,
    criterion,
    criterionLabelFa: WIZARD_CRITERION_LABELS_FA[criterion],
    criterionReasonFa: WIZARD_CRITERION_REASONS_FA[criterion],
    leadReasonFa: WIZARD_LEAD_REASONS_FA[criterion],
    notes,
    tableHref,
  } as const;

  const none = (reasonFa: string): WizardAnswered => ({
    ...answered,
    outcome: { kind: "none", reasonFa },
  });

  if (model.visible.length === 0) return none(WIZARD_NO_PRICE_FA);
  if (delivery === "yes" && !deliveryPossible) return none(WIZARD_NO_DELIVERY_FA);
  if (withinMinimum.length === 0) return none(WIZARD_BELOW_MINIMUM_FA);
  if (ranked.length === 0) return none(noCriterionFa(criterion));

  const best = ranked[0]?.percent ?? 0;
  const leaders = ranked.filter((candidate) => candidate.percent === best);
  if (
    leaders.length > MAX_WIZARD_LEADERS ||
    (leaders.length === ranked.length && ranked.length > 1)
  ) {
    return none(noSpreadFa(leaders.length, criterion));
  }
  return {
    ...answered,
    outcome: {
      kind: "match",
      leaders,
      alternatives: ranked.slice(leaders.length, leaders.length + MAX_WIZARD_ALTERNATIVES),
    },
  };
}
