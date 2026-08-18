import { ToolPage } from "@/components/content/ToolPage";
import {
  JEWELRY_FIELDS,
  JEWELRY_PROFIT_NOTE,
  JEWELRY_VAT_NOTE,
  JewelryResult,
  useJewelryCalculator,
} from "@/components/tablo/JewelryCalculator";
import { formatFaNumber } from "@/lib/fa-number";
import { formatDateTimeFa } from "@/lib/format";
import {
  JEWELRY_TOOL_BYLINE,
  JEWELRY_TOOL_FAQ,
  JEWELRY_TOOL_FORMULA,
  JEWELRY_TOOL_IDENTITY,
  JEWELRY_TOOL_RELATED,
  JEWELRY_TOOL_SOURCES,
  jewelryInterpretation,
  type JewelryToolData,
} from "@/lib/jewelry-tool";

const RATE_LABEL = "نرخ هر گرم طلای ۱۸ عیار";
const RATE_MISSING =
  "نرخ مرجع هر گرم طلا همین حالا در دسترس نیست. تا برگشتن داده، مبلغ نهایی محاسبه نمی‌شود.";
const HELP =
  "وزن را به گرم بنویسید و درصدها را از فاکتور خودتان بردارید. مالیات از قانون بودجه پر شده و قابل تغییر است.";

function RateLine({ data }: { data: JewelryToolData }) {
  if (data.pricePerGram === null) {
    return (
      <p data-tool-rate="missing" className="mt-3 text-[12px] leading-6 text-muted-foreground">
        {RATE_MISSING}
      </p>
    );
  }
  return (
    <p data-tool-rate="live" className="mt-3 text-[12px] leading-6 text-muted-foreground">
      {RATE_LABEL}:{" "}
      <span className="num font-semibold text-foreground">{formatFaNumber(data.pricePerGram)}</span>{" "}
      تومان، از نرخ مرجع {data.referenceName}
      {data.readAt !== null && (
        <>
          {" "}
          (آخرین ثبت: <time dateTime={data.readAt}>{formatDateTimeFa(data.readAt)}</time>)
        </>
      )}
    </p>
  );
}

export function JewelryToolPage({ data }: { data: JewelryToolData }) {
  const { values, setValue, breakdown } = useJewelryCalculator(data.pricePerGram);

  return (
    <ToolPage
      identity={JEWELRY_TOOL_IDENTITY}
      tool={
        <section className="rounded-[22px] border border-border bg-surface p-4 sm:p-5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {JEWELRY_FIELDS.map((field) => (
              <label
                key={field.key}
                className="transition-smooth flex items-center justify-between gap-2 rounded-[12px] border border-border px-3.5 py-3 text-[13.5px] focus-within:border-primary"
              >
                <span className="shrink-0 text-muted-foreground">{field.label}</span>
                <input
                  inputMode="decimal"
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  className="num w-24 bg-transparent text-left outline-none"
                  dir="ltr"
                />
              </label>
            ))}
          </div>

          <RateLine data={data} />

          <p className="mt-2 text-[12px] leading-6 text-muted-foreground">{HELP}</p>

          <p
            data-calculator-profit-note
            className="mt-2 text-[12px] leading-6 text-muted-foreground"
          >
            {JEWELRY_PROFIT_NOTE}
          </p>

          <p data-calculator-source className="mt-2 text-[12px] leading-6 text-muted-foreground">
            {JEWELRY_VAT_NOTE}
          </p>
        </section>
      }
      breakdown={
        <div className="space-y-3">
          <JewelryResult breakdown={breakdown} pricePerGram={data.pricePerGram} />
        </div>
      }
      interpretation={jewelryInterpretation(breakdown)}
      formula={JEWELRY_TOOL_FORMULA}
      faq={JEWELRY_TOOL_FAQ}
      sources={JEWELRY_TOOL_SOURCES}
      byline={JEWELRY_TOOL_BYLINE}
      related={JEWELRY_TOOL_RELATED}
    />
  );
}
