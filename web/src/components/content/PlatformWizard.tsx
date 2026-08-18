/**
 * ⚠️ The wizard is an ordinary `<form method="get">` whose whole state is the
 * query string, for the same reason the comparison table's controls are plain
 * links: the numbers it reasons about are server-rendered, so the answer has to
 * survive with JavaScript switched off. `onSubmit` is a pure enhancement — when
 * the route hands it in the navigation happens client-side, and when it is
 * absent the browser submits the form and the server renders the same answer.
 *
 * ⚠️ No monetization field is read here either; the outbound button is built
 * from the platform slug alone and always goes through `/go/`.
 */
import type { FormEvent } from "react";

import { Staleness } from "@/components/content/RowParts";
import { Input } from "@/components/ui/input";
import { CALC_TOOL_WIZARD } from "@/lib/calc-events";
import { formatPercentPointsFa, formatToman } from "@/lib/format";
import { useCalcEvents } from "@/lib/use-calc-events";
import {
  amountFromInput,
  asYesNo,
  buildWizardResult,
  WIZARD_ASSET_SLUG,
  WIZARD_COMMISSION_FA,
  WIZARD_DELIVERY_TERMS_PREFIX_FA,
  WIZARD_MISSING_FA,
  WIZARD_NEUTRALITY_FA,
  WIZARD_PATH,
  WIZARD_QUESTION_HINTS_FA,
  WIZARD_QUESTION_LABELS_FA,
  WIZARD_TIE_FA,
  wizardSearchOf,
  type WizardCandidate,
  type WizardResult,
  type WizardSearch,
} from "@/lib/wizard";
import type { WizardPageData } from "@/lib/wizard-data";

const YES_NO_LABELS_FA = { yes: "بله", no: "نه" } as const;

const HEADINGS = {
  form: "سه پرسش",
  answer: "جواب تابلو",
  alternatives: "سکوهای بعدی در همین معیار",
  notes: "این پیشنهاد بر چه پایه‌ای است و چه چیزی را نمی‌داند",
} as const;

const SUBMIT_FA = "پیشنهاد را ببینید";
const RESET_FA = "پاک کردن جواب‌ها";
const TABLE_LINK_FA = "همین معیار را در جدول کامل ببینید";
const MISSING_HEADING_FA = "برای رسیدن به جواب، این‌ها مانده است:";
const AMOUNT_UNIT_FA = "تومان";
const AMOUNT_PLACEHOLDER = "۱۰۰٬۰۰۰٬۰۰۰";

function ChoiceField({ name, value }: { name: "delivery" | "resale"; value: string | undefined }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-medium text-foreground">
        {WIZARD_QUESTION_LABELS_FA[name]}
      </legend>
      <p className="text-[11px] leading-6 text-muted-foreground">
        {WIZARD_QUESTION_HINTS_FA[name]}
      </p>
      <div className="flex flex-wrap gap-4 text-[13px]">
        {(["yes", "no"] as const).map((choice) => (
          <label key={choice} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={choice}
              data-wizard-choice={`${name}:${choice}`}
              defaultChecked={value === choice}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            {YES_NO_LABELS_FA[choice]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function WizardForm({
  search,
  onSubmit,
}: {
  search: WizardSearch;
  onSubmit?: ((next: WizardSearch) => void) | undefined;
}) {
  const amount = amountFromInput(search.amount ?? null);

  function submit(event: FormEvent<HTMLFormElement>): void {
    if (onSubmit === undefined) return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit(
      wizardSearchOf({
        amount: String(data.get("amount") ?? ""),
        delivery: data.get("delivery"),
        resale: data.get("resale"),
      }),
    );
  }

  return (
    <form
      data-wizard-form
      method="get"
      action={WIZARD_PATH}
      onSubmit={onSubmit === undefined ? undefined : submit}
      className="flex flex-col gap-6"
    >
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-foreground">
          {WIZARD_QUESTION_LABELS_FA.amount}
        </span>
        <span className="text-[11px] leading-6 text-muted-foreground">
          {WIZARD_QUESTION_HINTS_FA.amount}
        </span>
        <span className="relative max-w-[320px]">
          <Input
            data-wizard-amount
            name="amount"
            type="text"
            inputMode="numeric"
            dir="ltr"
            placeholder={AMOUNT_PLACEHOLDER}
            defaultValue={amount === null ? "" : formatToman(amount)}
            className="pe-14 text-end tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[11px] text-muted-foreground">
            {AMOUNT_UNIT_FA}
          </span>
        </span>
      </label>

      <ChoiceField name="delivery" value={search.delivery} />
      <ChoiceField name="resale" value={search.resale} />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          data-wizard-submit
          className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          {SUBMIT_FA}
        </button>
        <a
          href={WIZARD_PATH}
          className="transition-smooth text-[12px] text-primary hover:underline"
        >
          {RESET_FA}
        </a>
      </div>
    </form>
  );
}

function CandidateBlock({
  candidate,
  criterionLabelFa,
  nowMs,
  primary,
}: {
  candidate: WizardCandidate;
  criterionLabelFa: string;
  nowMs: number;
  primary: boolean;
}) {
  return (
    <div
      data-wizard-leader={primary ? candidate.slug : undefined}
      data-wizard-alternative={primary ? undefined : candidate.slug}
      className={
        primary
          ? "rounded-[20px] border border-primary/40 bg-surface px-5 py-4"
          : "rounded-[18px] border border-border bg-surface px-4 py-3"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <a
          href={`/${candidate.slug}`}
          className={
            primary
              ? "transition-smooth text-base font-bold text-foreground hover:text-primary"
              : "transition-smooth text-[14px] font-medium text-foreground hover:text-primary"
          }
        >
          {candidate.nameFa}
        </a>
        <span className="num text-[14px] font-semibold text-primary">
          {criterionLabelFa} {formatPercentPointsFa(candidate.percent)}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-7 text-foreground/80">
        روی مبلغی که نوشتید حدود{" "}
        <strong className="num font-semibold">{formatToman(candidate.feeToman)}</strong>{" "}
        {AMOUNT_UNIT_FA} می‌شود.
      </p>
      {candidate.deliveryNoteFa === null ? null : (
        <p data-wizard-delivery-note className="mt-2 text-[12px] leading-7 text-muted-foreground">
          {WIZARD_DELIVERY_TERMS_PREFIX_FA} {candidate.deliveryNoteFa}
        </p>
      )}
      <p className="mt-2">
        <Staleness updatedAt={candidate.updatedAt} nowMs={nowMs} />
      </p>
      {primary && candidate.outbound ? (
        <p className="mt-3">
          <a
            href={`/go/${candidate.slug}`}
            rel="sponsored nofollow noopener"
            target="_blank"
            data-outbound="wizard"
            className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            رفتن به {candidate.nameFa}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ResultBlock({ result, nowMs }: { result: WizardResult; nowMs: number }) {
  if (result.kind === "unanswered") {
    if (result.missing.length === 3) return null;
    return (
      <section data-wizard-result data-wizard-outcome="unanswered" className="mt-8">
        <h2 className="text-base font-semibold text-foreground">{HEADINGS.answer}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">{MISSING_HEADING_FA}</p>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-[13px] text-foreground/80">
          {result.missing.map((question) => (
            <li key={question}>{WIZARD_MISSING_FA[question]}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      data-wizard-result
      data-wizard-outcome={result.outcome.kind}
      data-wizard-criterion={result.criterion}
      className="mt-8"
    >
      <h2 className="text-base font-semibold text-foreground sm:text-lg">{HEADINGS.answer}</h2>
      <p className="mt-2 text-[13.5px] leading-8 text-foreground/85">{result.criterionReasonFa}</p>

      {result.outcome.kind === "none" ? (
        <p data-wizard-none className="mt-4 text-[13.5px] leading-8 text-foreground/85">
          {result.outcome.reasonFa}
        </p>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-muted-foreground">{result.leadReasonFa}</p>
          <div className="mt-3 flex flex-col gap-3">
            {result.outcome.leaders.map((candidate) => (
              <CandidateBlock
                key={candidate.slug}
                candidate={candidate}
                criterionLabelFa={result.criterionLabelFa}
                nowMs={nowMs}
                primary
              />
            ))}
          </div>
          {result.outcome.leaders.length > 1 ? (
            <p data-wizard-tie className="mt-3 text-[12.5px] leading-7 text-muted-foreground">
              {WIZARD_TIE_FA}
            </p>
          ) : null}

          {result.outcome.alternatives.length === 0 ? null : (
            <>
              <h3 className="mt-7 text-[14px] font-semibold text-foreground">
                {HEADINGS.alternatives}
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {result.outcome.alternatives.map((candidate) => (
                  <CandidateBlock
                    key={candidate.slug}
                    candidate={candidate}
                    criterionLabelFa={result.criterionLabelFa}
                    nowMs={nowMs}
                    primary={false}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="mt-5 text-[13px]">
        <a
          href={result.tableHref}
          rel="nofollow"
          data-wizard-table-link
          className="transition-smooth text-primary hover:underline"
        >
          {TABLE_LINK_FA}
        </a>
      </p>

      <h3 className="mt-7 text-[14px] font-semibold text-foreground">{HEADINGS.notes}</h3>
      <ul className="mt-2 list-disc space-y-2 pr-5 text-[12.5px] leading-7 text-muted-foreground">
        {result.notes.map((note) => (
          <li key={note} data-wizard-note>
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ⚠️ `calc_complete` fires only when a recommendation was actually produced.
 * A wizard run that ends in «سکویی پیشنهاد نمی‌کنیم» is an honest answer but
 * not a completed decision, and counting it would let our own data gaps
 * inflate the north-star metric.
 */
export function PlatformWizard({
  data,
  search,
  onSubmit,
}: {
  data: WizardPageData;
  search: WizardSearch;
  onSubmit?: ((next: WizardSearch) => void) | undefined;
}) {
  const nowMs = Date.parse(data.generated_at);
  const result = buildWizardResult({
    rows: data.rows,
    instrument: data.listing?.instrument ?? "GOLD_18K",
    nowMs,
    search,
    tablePath: `/${data.listing?.slug ?? WIZARD_ASSET_SLUG}`,
  });

  useCalcEvents({
    tool: CALC_TOOL_WIZARD,
    initial: { amount: "", delivery: "", resale: "" },
    values: {
      amount: search.amount === undefined ? "" : String(search.amount),
      delivery: asYesNo(search.delivery) ?? "",
      resale: asYesNo(search.resale) ?? "",
    },
    hasResult: result.kind === "answered" && result.outcome.kind === "match",
  });

  return (
    <section data-platform-wizard aria-labelledby="wizard-heading">
      <h2 id="wizard-heading" className="text-base font-semibold text-foreground sm:text-lg">
        {HEADINGS.form}
      </h2>
      <div className="mt-4">
        <WizardForm search={search} onSubmit={onSubmit} />
      </div>
      <ResultBlock result={result} nowMs={nowMs} />
      <p className="mt-6 border-t border-border/70 pt-4 text-[11.5px] leading-6 text-muted-foreground">
        {WIZARD_NEUTRALITY_FA}
      </p>
      <p data-wizard-commission className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
        {WIZARD_COMMISSION_FA}
      </p>
    </section>
  );
}
