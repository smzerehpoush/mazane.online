/**
 * ⚠️ Every field here is human-authored and arrives through the admin panel,
 * never through an adapter, so an operator who can type could otherwise
 * reorder the comparison table. Exactly one field is allowed out of display,
 * deliberately: `min_buy_toman` is the «حداقل خرید» sort column and the
 * wizard's amount exclusion. It earns that because it is printed as its own
 * visible number in the row it ranks, and because
 * `tests/ranking-neutrality.test.tsx` varies it alongside referral ownership.
 * Every other field in this module is display-only and must never become an
 * input to ordering, ranking or the wizard's recommendation.
 */
import { formatFaNumber } from "./fa-number";

export const PAYMENT_METHODS = [
  "GATEWAY",
  "CARD_TO_CARD",
  "DIRECT_DEBIT",
  "WALLET",
  "IBAN_TRANSFER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const KYC_LEVELS = ["NONE", "BASIC", "FULL"] as const;
export type KycLevel = (typeof KYC_LEVELS)[number];

export const MOBILE_APPS = ["WEB_ONLY", "ANDROID", "IOS", "BOTH"] as const;
export type MobileApp = (typeof MOBILE_APPS)[number];

export interface FaqItem {
  question_fa: string;
  answer_fa: string;
}

export interface PlatformProfile {
  payment_methods: PaymentMethod[];
  kyc_level: KycLevel | null;
  mobile_app: MobileApp | null;
  delivery_cost_fa: string | null;
  min_buy_toman: number | null;
  min_sell_toman: number | null;
  pros_fa: string[];
  cons_fa: string[];
  faq: FaqItem[];
}

export interface PlatformProfileEntry extends PlatformProfile {
  slug: string;
}

export const PAYMENT_METHOD_LABELS_FA: Record<PaymentMethod, string> = {
  GATEWAY: "درگاه بانکی",
  CARD_TO_CARD: "کارت به کارت",
  DIRECT_DEBIT: "پرداخت مستقیم",
  WALLET: "کیف پول داخلی",
  IBAN_TRANSFER: "انتقال بانکی (پایا و ساتنا)",
};

export const KYC_LEVEL_LABELS_FA: Record<KycLevel, string> = {
  NONE: "بدون احراز هویت",
  BASIC: "شماره موبایل و کد ملی",
  FULL: "احراز هویت کامل با تصویر",
};

export const MOBILE_APP_LABELS_FA: Record<MobileApp, string> = {
  WEB_ONLY: "فقط نسخه‌ی وب",
  ANDROID: "اندروید",
  IOS: "iOS",
  BOTH: "اندروید و iOS",
};

export const MAX_LINE_LENGTH = 400;
export const MAX_ANSWER_LENGTH = 1200;
export const MAX_LIST_ITEMS = 8;
export const MAX_FAQ_ITEMS = 10;

export function emptyProfile(): PlatformProfile {
  return {
    payment_methods: [],
    kyc_level: null,
    mobile_app: null,
    delivery_cost_fa: null,
    min_buy_toman: null,
    min_sell_toman: null,
    pros_fa: [],
    cons_fa: [],
    faq: [],
  };
}

function cleanText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function cleanLines(values: readonly string[]): string[] {
  return values.map((line) => line.trim()).filter((line) => line.length > 0);
}

export function linesToList(text: string): string[] {
  return cleanLines(text.split("\n"));
}

export function listToLines(values: readonly string[]): string {
  return values.join("\n");
}

export function normalizePlatformProfile(entry: PlatformProfileEntry): PlatformProfileEntry {
  const seen = new Set<PaymentMethod>();
  const payment_methods = PAYMENT_METHODS.filter((method) => {
    if (!entry.payment_methods.includes(method) || seen.has(method)) return false;
    seen.add(method);
    return true;
  });
  return {
    slug: entry.slug,
    payment_methods,
    kyc_level: entry.kyc_level,
    mobile_app: entry.mobile_app,
    delivery_cost_fa: cleanText(entry.delivery_cost_fa),
    min_buy_toman: entry.min_buy_toman,
    min_sell_toman: entry.min_sell_toman,
    pros_fa: cleanLines(entry.pros_fa),
    cons_fa: cleanLines(entry.cons_fa),
    faq: entry.faq
      .map((item) => ({
        question_fa: item.question_fa.trim(),
        answer_fa: item.answer_fa.trim(),
      }))
      .filter((item) => item.question_fa.length > 0 && item.answer_fa.length > 0),
  };
}

function minimumError(slug: string, label: string, value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    return `${label} ${slug} باید یک عدد صحیح بزرگ‌تر از صفر باشد`;
  }
  return null;
}

export function validatePlatformProfiles(
  entries: readonly PlatformProfileEntry[],
  listedSlugs: ReadonlySet<string>,
): string | null {
  for (const entry of entries) {
    if (!listedSlugs.has(entry.slug)) {
      return `سکوی ناشناخته یا غیرقابل‌نمایش: ${entry.slug}`;
    }
    for (const method of entry.payment_methods) {
      if (!PAYMENT_METHODS.includes(method)) {
        return `روش پرداخت ناشناخته برای ${entry.slug}`;
      }
    }
    if (entry.kyc_level !== null && !KYC_LEVELS.includes(entry.kyc_level)) {
      return `سطح احراز هویت ناشناخته برای ${entry.slug}`;
    }
    if (entry.mobile_app !== null && !MOBILE_APPS.includes(entry.mobile_app)) {
      return `وضعیت اپلیکیشن ناشناخته برای ${entry.slug}`;
    }
    const buyError = minimumError(entry.slug, "حداقل خرید", entry.min_buy_toman);
    if (buyError !== null) return buyError;
    const sellError = minimumError(entry.slug, "حداقل فروش", entry.min_sell_toman);
    if (sellError !== null) return sellError;

    if ((entry.delivery_cost_fa?.length ?? 0) > MAX_LINE_LENGTH) {
      return `توضیح هزینه‌ی تحویل ${entry.slug} بیش از حد بلند است`;
    }
    for (const [label, list] of [
      ["نقاط قوت", entry.pros_fa],
      ["نقاط ضعف", entry.cons_fa],
    ] as const) {
      if (list.length > MAX_LIST_ITEMS) {
        return `${label} ${entry.slug} بیش از ${formatFaNumber(MAX_LIST_ITEMS)} مورد دارد`;
      }
      if (list.some((line) => line.length > MAX_LINE_LENGTH)) {
        return `یکی از موارد ${label} ${entry.slug} بیش از حد بلند است`;
      }
    }
    if (entry.faq.length > MAX_FAQ_ITEMS) {
      return `پرسش‌های ${entry.slug} بیش از ${formatFaNumber(MAX_FAQ_ITEMS)} مورد است`;
    }
    for (const item of entry.faq) {
      if (item.question_fa.length > MAX_LINE_LENGTH || item.answer_fa.length > MAX_ANSWER_LENGTH) {
        return `یکی از پرسش‌های ${entry.slug} بیش از حد بلند است`;
      }
    }
  }
  return null;
}

export interface PlatformProfilesSource {
  readProfiles(): Promise<PlatformProfileEntry[]>;
  writeProfiles(entries: PlatformProfileEntry[]): Promise<void>;
}

export type PlatformProfilesFactory = () => PlatformProfilesSource;

let activeSource: PlatformProfilesSource | null = null;
let defaultFactory: PlatformProfilesFactory | null = null;

export function setPlatformProfilesSource(source: PlatformProfilesSource): void {
  activeSource = source;
}

export function setDefaultPlatformProfilesSource(factory: PlatformProfilesFactory): void {
  defaultFactory = factory;
}

export function resetPlatformProfilesSource(): void {
  activeSource = null;
}

function source(): PlatformProfilesSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error("platform profiles source not configured");
  }
  activeSource = defaultFactory();
  return activeSource;
}

/**
 * ⚠️ "Staleness, not error": the panel still has to open when the profile
 * table is unreachable, so a failed read degrades to "no profile saved yet"
 * instead of a 500 that hides the chart settings too.
 */
export async function loadPlatformProfiles(
  slugs: readonly string[],
): Promise<PlatformProfileEntry[]> {
  let saved: PlatformProfileEntry[] = [];
  try {
    saved = await source().readProfiles();
  } catch (error) {
    console.error("platform profiles unavailable; the panel opens with empty profiles", error);
  }
  const bySlug = new Map(saved.map((entry) => [entry.slug, entry]));
  return slugs.map((slug) => bySlug.get(slug) ?? { slug, ...emptyProfile() });
}

export async function savePlatformProfiles(
  entries: readonly PlatformProfileEntry[],
  listedSlugs: ReadonlySet<string>,
): Promise<string | null> {
  const normalized = entries.map(normalizePlatformProfile);
  const error = validatePlatformProfiles(normalized, listedSlugs);
  if (error !== null) return error;
  await source().writeProfiles(normalized);
  return null;
}
