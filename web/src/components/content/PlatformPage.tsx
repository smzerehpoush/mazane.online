import type { ReactNode } from "react";

import { Madde5Bar } from "@/components/content/LegalNotice";
import { PlatformCalculator } from "@/components/content/PlatformCalculator";
import { PlatformRateCard } from "@/components/content/PlatformRateCard";
import { RelatedLinksBlock } from "@/components/content/RelatedLinks";
import {
  ClosedBadges,
  FeeSourceLabel,
  MarketModelBadge,
  Staleness,
} from "@/components/content/RowParts";
import { relatedLinksForPath } from "@/lib/clusters";
import {
  formatDateTimeFa,
  formatDateFa,
  formatPercentPointsFa,
  formatToman,
  formatYearFa,
} from "@/lib/format";
import type { PlatformHistoryByRange } from "@/lib/history";
import {
  KYC_LEVEL_LABELS_FA,
  MOBILE_APP_LABELS_FA,
  PAYMENT_METHOD_LABELS_FA,
  type PlatformProfile,
} from "@/lib/platform-profile";
import type { ListedPlatform, PlatformSnapshot } from "@/lib/prices";
import type { ReferencePrice } from "@/lib/reference-price";
import { priceToman, type Row } from "@/lib/rows";
import { FEE_UNDISCLOSED_FA, FEES_UNDISCLOSED_FA } from "@/lib/undisclosed";

const PRICE_EXPLANATION_FA =
  "این عدد قیمت اعلامی همین سکوست، پیش از کارمزد. آنچه می‌پردازید یا می‌گیرید، به کارمزد خرید و فروش زیر بستگی دارد.";

const LEGAL_ENTITY_UNKNOWN_FA = "هنوز نمی‌دانیم این سکو زیر نام کدام شرکت ثبت شده است";
const DELIVERY_UNKNOWN_FA = "تحویل فیزیکی این سکو را هنوز بررسی نکرده‌ایم";

/**
 * ⚠️ These sentences replace an empty field only inside a section that has at
 * least one filled field. A section with nothing in it does not render at all,
 * so a page whose profile is untouched stays exactly as it was. Never put a
 * placeholder such as «ثبت نشده است» or a bare dash here: it reads as a claim
 * about the platform instead of an admission about us.
 */
const FOUNDED_YEAR_UNKNOWN_FA = "سال تأسیس این سکو را هنوز پیدا نکرده‌ایم";
const MOBILE_APP_UNKNOWN_FA = "هنوز بررسی نکرده‌ایم این سکو اپلیکیشن موبایل دارد یا نه";
const PAYMENT_METHODS_UNKNOWN_FA = "روش‌های پرداخت این سکو را هنوز بررسی نکرده‌ایم";
const KYC_UNKNOWN_FA = "هنوز نمی‌دانیم این سکو برای شروع چه احراز هویتی می‌خواهد";
const MIN_BUY_UNKNOWN_FA = "حداقل مبلغ خرید این سکو را هنوز بررسی نکرده‌ایم";
const MIN_SELL_UNKNOWN_FA = "حداقل مبلغ فروش این سکو را هنوز بررسی نکرده‌ایم";
const DELIVERY_COST_UNKNOWN_FA = "هزینه‌ی تحویل فیزیکی این سکو را هنوز بررسی نکرده‌ایم";
const PROS_UNKNOWN_FA = "نقاط قوت این سکو را هنوز جمع‌بندی نکرده‌ایم";
const CONS_UNKNOWN_FA = "نقاط ضعف این سکو را هنوز جمع‌بندی نکرده‌ایم";
const EDITORIAL_NOTE_FA = "این جمع‌بندی نظر تحریریه‌ی تابلوست، نه ادعای خود سکو.";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] leading-6">{children}</dd>
    </div>
  );
}

function PriceCard({ toman }: { toman: number | null }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-4">
      <p className="text-[11px] text-muted-foreground">قیمت هر گرم (پیش از کارمزد)</p>
      <p data-price className="mt-1 text-lg font-bold tabular-nums sm:text-xl">
        {toman === null ? "—" : `${formatToman(toman)} تومان`}
      </p>
    </div>
  );
}

/** ⚠️ This reference figure never enters any calculation and is never shown as a platform's price. */
function UnionRateBar({ referencePrice }: { referencePrice: ReferencePrice | null }) {
  if (referencePrice === null) return null;
  return (
    <p
      data-union-rate
      className="card-surface mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-[12px]"
    >
      <span className="text-muted-foreground">نرخ اتحادیه (۱۸ عیار)</span>
      <span className="flex items-center gap-2 font-semibold tabular-nums">
        {formatToman(referencePrice.value)} تومان
        <time dateTime={referencePrice.read_at} className="font-normal text-muted-foreground">
          {formatDateTimeFa(referencePrice.read_at)}
        </time>
      </span>
    </p>
  );
}

function TermsSection({
  row,
  snapshot,
  updatedAt,
}: {
  row: Row;
  snapshot: PlatformSnapshot;
  updatedAt: string | null;
}) {
  const { terms } = snapshot;
  const price = priceToman(row);
  const dateLabel = updatedAt === null ? null : formatDateFa(updatedAt);
  const fees = [
    { label: "کارمزد خرید", percent: terms.buy_fee_percent },
    { label: "کارمزد فروش", percent: terms.sell_fee_percent },
    { label: "هزینه‌ی رفت‌وبرگشت", percent: terms.round_trip_percent },
  ];
  const anyFeeDisclosed = fees.some((fee) => fee.percent !== null);

  return (
    <section aria-labelledby="terms-heading" className="card-surface px-5 py-5 sm:px-6">
      <h2 id="terms-heading" className="text-base font-semibold sm:text-lg">
        قیمت امروز{dateLabel === null ? null : ` — ${dateLabel}`}
      </h2>

      <div className="mt-4">
        <PriceCard toman={price} />
      </div>

      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">{PRICE_EXPLANATION_FA}</p>

      <dl className="mt-3">
        {anyFeeDisclosed ? (
          <>
            {fees.map((fee) => (
              <Field key={fee.label} label={fee.label}>
                {fee.percent === null ? FEE_UNDISCLOSED_FA : formatPercentPointsFa(fee.percent)}
              </Field>
            ))}
            <Field label="منبع کارمزد">
              <FeeSourceLabel terms={terms} />
            </Field>
          </>
        ) : (
          <Field label="کارمزد">{FEES_UNDISCLOSED_FA}</Field>
        )}
      </dl>
    </section>
  );
}

function tomanOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ProfileSection({ platform }: { platform: ListedPlatform }) {
  const profile: PlatformProfile | null = platform.profile ?? null;
  const foundedYear = platform.founded_year_jalali ?? null;
  const paymentMethods = profile?.payment_methods ?? [];
  const kycLevel = profile?.kyc_level ?? null;
  const mobileApp = profile?.mobile_app ?? null;
  const minBuy = tomanOrNull(profile?.min_buy_toman);
  const minSell = tomanOrNull(profile?.min_sell_toman);
  const deliveryCost = profile?.delivery_cost_fa ?? null;

  const anythingKnown =
    foundedYear !== null ||
    paymentMethods.length > 0 ||
    kycLevel !== null ||
    mobileApp !== null ||
    minBuy !== null ||
    minSell !== null ||
    deliveryCost !== null;
  if (!anythingKnown) return null;

  return (
    <section aria-labelledby="profile-heading" className="card-surface mt-6 px-5 py-5 sm:px-6">
      <h2 id="profile-heading" className="text-base font-semibold sm:text-lg">
        شرایط و مشخصات
      </h2>
      <dl className="mt-3" data-platform-profile>
        <Field label="سال تأسیس">
          <span data-founded-year>
            {foundedYear === null ? FOUNDED_YEAR_UNKNOWN_FA : formatYearFa(foundedYear)}
          </span>
        </Field>
        <Field label="اپلیکیشن موبایل">
          <span data-mobile-app>
            {mobileApp === null ? MOBILE_APP_UNKNOWN_FA : MOBILE_APP_LABELS_FA[mobileApp]}
          </span>
        </Field>
        <Field label="روش‌های پرداخت">
          <span data-payment-methods>
            {paymentMethods.length === 0
              ? PAYMENT_METHODS_UNKNOWN_FA
              : paymentMethods.map((method) => PAYMENT_METHOD_LABELS_FA[method]).join("، ")}
          </span>
        </Field>
        <Field label="احراز هویت">
          <span data-kyc-level>
            {kycLevel === null ? KYC_UNKNOWN_FA : KYC_LEVEL_LABELS_FA[kycLevel]}
          </span>
        </Field>
        <Field label="حداقل خرید">
          <span data-min-buy>
            {minBuy === null ? MIN_BUY_UNKNOWN_FA : `${formatToman(minBuy)} تومان`}
          </span>
        </Field>
        <Field label="حداقل فروش">
          <span data-min-sell>
            {minSell === null ? MIN_SELL_UNKNOWN_FA : `${formatToman(minSell)} تومان`}
          </span>
        </Field>
        <Field label="هزینه‌ی تحویل">
          <span data-delivery-cost>{deliveryCost ?? DELIVERY_COST_UNKNOWN_FA}</span>
        </Field>
      </dl>
    </section>
  );
}

function JudgementList({
  label,
  items,
  emptyFa,
  testId,
}: {
  label: string;
  items: readonly string[];
  emptyFa: string;
  testId: string;
}) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold">{label}</h3>
      {items.length === 0 ? (
        <p data-empty={testId} className="mt-2 text-[13px] leading-6 text-muted-foreground">
          {emptyFa}
        </p>
      ) : (
        <ul data-list={testId} className="mt-2 flex flex-col gap-1 text-[13px] leading-6">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-muted-foreground">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProsConsSection({ platform }: { platform: ListedPlatform }) {
  const pros = platform.profile?.pros_fa ?? [];
  const cons = platform.profile?.cons_fa ?? [];
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <section aria-labelledby="pros-cons-heading" className="card-surface mt-6 px-5 py-5 sm:px-6">
      <h2 id="pros-cons-heading" className="text-base font-semibold sm:text-lg">
        نقاط قوت و ضعف
      </h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <JudgementList label="نقاط قوت" items={pros} emptyFa={PROS_UNKNOWN_FA} testId="pros" />
        <JudgementList label="نقاط ضعف" items={cons} emptyFa={CONS_UNKNOWN_FA} testId="cons" />
      </div>
      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">{EDITORIAL_NOTE_FA}</p>
    </section>
  );
}

function PlatformFaqSection({ platform }: { platform: ListedPlatform }) {
  const faq = platform.profile?.faq ?? [];
  if (faq.length === 0) return null;

  return (
    <section aria-labelledby="platform-faq-heading" className="card-surface mt-6 px-5 py-5 sm:px-6">
      <h2 id="platform-faq-heading" className="text-base font-semibold sm:text-lg">
        پرسش‌های پرتکرار درباره‌ی {platform.name_fa}
      </h2>
      <dl className="mt-3" data-platform-faq>
        {faq.map((item) => (
          <div
            key={item.question_fa}
            className="border-b border-border/60 py-3 last:border-0 last:pb-0"
          >
            <dt className="text-[13px] font-semibold leading-6">{item.question_fa}</dt>
            <dd className="mt-1 text-[13px] leading-6 text-muted-foreground">{item.answer_fa}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PlatformPage({
  platform,
  snapshot,
  updatedAt,
  hasOutbound,
  instrumentNames,
  history,
  referencePrice,
  nowMs,
}: {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
  hasOutbound: boolean;
  instrumentNames: Record<string, string>;
  history: PlatformHistoryByRange;
  referencePrice: ReferencePrice | null;
  nowMs: number;
}) {
  const row: Row = { platform, snapshot, updatedAt };

  return (
    <>
      <div className="grid gap-6 mb-6 lg:mb-0 lg:grid-cols-2 lg:items-start">
        <header className="order-2 lg:order-none">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
            {platform.name_fa}
            {platform.name_en ? (
              <span className="text-sm font-normal text-muted-foreground">
                ({platform.name_en})
              </span>
            ) : null}
            <MarketModelBadge platform={platform} />
            {snapshot === null ? null : <ClosedBadges terms={snapshot.terms} />}
          </h1>
          <p className="mt-2">
            <Staleness updatedAt={updatedAt} nowMs={nowMs} />
          </p>
          {!hasOutbound ? null : (
            <p className="mt-4">
              <a
                href={`/go/${platform.slug}`}
                rel="sponsored nofollow noopener"
                target="_blank"
                data-outbound="website"
                className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                ورود و شروع معامله
              </a>
            </p>
          )}
        </header>

        <div className="order-1 lg:order-none">
          <PlatformRateCard row={row} history={history} nowMs={nowMs} />
        </div>
      </div>

      <UnionRateBar referencePrice={referencePrice} />

      {snapshot === null ? (
        <p className="card-surface px-5 py-8 text-center text-sm text-muted-foreground">
          قیمت در دسترس نیست
        </p>
      ) : (
        <TermsSection row={row} snapshot={snapshot} updatedAt={updatedAt} />
      )}

      <PlatformCalculator row={row} hasOutbound={hasOutbound} />

      <section aria-labelledby="identity-heading" className="card-surface mt-6 px-5 py-5 sm:px-6">
        <h2 id="identity-heading" className="text-base font-semibold sm:text-lg">
          هویت و تحویل فیزیکی
        </h2>
        <dl className="mt-3">
          <Field label="هویت حقوقی">
            <span data-legal-entity>{platform.legal_entity ?? LEGAL_ENTITY_UNKNOWN_FA}</span>
          </Field>
          <Field label="تحویل فیزیکی">
            <span data-delivery-note>{platform.delivery_note_fa ?? DELIVERY_UNKNOWN_FA}</span>
          </Field>
        </dl>
      </section>

      <ProfileSection platform={platform} />
      <ProsConsSection platform={platform} />
      <PlatformFaqSection platform={platform} />

      <RelatedLinksBlock
        links={relatedLinksForPath(`/${platform.slug}`)}
        className="card-surface mt-6 px-5 py-5 sm:px-6"
      />

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به مقایسه‌ی قیمت سکوها
        </a>
      </p>

      <Madde5Bar />
    </>
  );
}
