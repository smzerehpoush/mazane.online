import type { ComponentType, ReactNode } from "react";

import { TomanPrice } from "@/components/tablo/TomanPrice";
import { useJewelryCalculator } from "@/components/tablo/JewelryCalculator";
import { SELL_BACK_CEILING_NOTE, useSellBackForm } from "@/components/tablo/SellBackCalculator";
import { useMazaneForm } from "@/components/tablo/MazaneConverter";
import type { RailSource } from "@/lib/dashboard";
import { formatFaNumber } from "@/lib/fa-number";
import type { LiveDashboardSource } from "@/lib/live-update";
import type { HomeAction } from "@/lib/site-content";

const LABELS = {
  weight: "وزن (گرم)",
  wage: "اجرت (٪)",
  deduction: "کسر خریدار (٪)",
  mazane: "مظنه (تومان)",
  jewelryResult: "مبلغ نهایی",
  sellBackResult: "به شما می‌رسد",
  mazaneResult: "هر گرم",
  cheapest: "ارزان‌ترین",
  spread: "اختلاف تا گران‌ترین",
  noRate: "نرخ مرجع در دسترس نیست.",
  noRail: "هنوز نرخی از سکوها ثبت نشده است.",
} as const;

const CTA = {
  "/mohasebe-tala": "تفکیک کامل فاکتور",
  "/mohasebe-forush-tala": "ابزار کامل فروش",
  "/tabdil-mazane": "ابزار کامل تبدیل",
  "/tala-18": "جدول کامل سکوها",
} as const;

const DEFAULT_CTA = "باز کردن ابزار";

export interface CheapestView {
  name: string | null;
  priceDisplay: string | null;
  spreadDisplay: string | null;
}

/**
 * ⚠️ Reads `live` when it is there, because the rail right below this widget
 * is patched live by `DashboardLive`: leaving this one on the loader snapshot
 * would put two different "cheapest" numbers on the same screen.
 */
export function cheapestView(
  sources: readonly RailSource[],
  live: readonly LiveDashboardSource[] | null,
): CheapestView {
  const livePrice = new Map(live?.map((source) => [source.slug, source.price_toman]) ?? []);
  const priced = sources
    .map((source) => ({
      name: source.name,
      price: livePrice.get(source.slug) ?? source.priceToman,
    }))
    .filter((entry): entry is { name: string; price: number } => entry.price !== null);

  if (priced.length === 0) return { name: null, priceDisplay: null, spreadDisplay: null };

  const prices = priced.map((entry) => entry.price);
  const min = Math.min(...prices);
  const cheapest = priced.find((entry) => entry.price === min) ?? null;

  return {
    name: cheapest?.name ?? null,
    priceDisplay: formatFaNumber(min),
    spreadDisplay: priced.length < 2 ? null : formatFaNumber(Math.max(...prices) - min),
  };
}

function WidgetField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="widget-field">
      <span>{label}</span>
      <input
        name={name}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="widget-input"
        dir="ltr"
      />
    </label>
  );
}

function WidgetTotal({
  label,
  value,
  tool,
}: {
  label: string;
  value: number | null;
  tool: string;
}) {
  return (
    <div className="widget-total widget-row">
      <span>{label}</span>
      <span data-widget-result={tool} className="widget-value">
        {value === null ? "—" : <TomanPrice value={formatFaNumber(value)} />}
      </span>
    </div>
  );
}

function WidgetNote({ children }: { children: ReactNode }) {
  return <p className="text-meta text-tx3">{children}</p>;
}

function JewelryWidget({ pricePerGram }: { pricePerGram: number | null }) {
  const { values, setValue, breakdown } = useJewelryCalculator(pricePerGram);

  return (
    <>
      <WidgetField
        label={LABELS.weight}
        name="widget-jewelry-weight"
        value={values["weight"] ?? ""}
        onChange={(value) => setValue("weight", value)}
      />
      <WidgetField
        label={LABELS.wage}
        name="widget-jewelry-wage"
        value={values["wage"] ?? ""}
        onChange={(value) => setValue("wage", value)}
      />
      {pricePerGram === null && <WidgetNote>{LABELS.noRate}</WidgetNote>}
      <WidgetTotal label={LABELS.jewelryResult} value={breakdown?.total ?? null} tool="jewelry" />
    </>
  );
}

function SellBackWidget({ pricePerGram }: { pricePerGram: number | null }) {
  const form = useSellBackForm(pricePerGram);

  return (
    <>
      <WidgetField
        label={LABELS.weight}
        name="widget-sellback-weight"
        value={form.values["weight"] ?? ""}
        onChange={(value) => form.setValue("weight", value)}
      />
      <WidgetField
        label={LABELS.deduction}
        name="widget-sellback-deduction"
        value={form.values["deduction"] ?? ""}
        onChange={(value) => form.setValue("deduction", value)}
      />
      {form.breakdown !== null && !form.deductionEntered && (
        <WidgetNote>
          <span data-widget-ceiling-note>{SELL_BACK_CEILING_NOTE}</span>
        </WidgetNote>
      )}
      {pricePerGram === null && <WidgetNote>{LABELS.noRate}</WidgetNote>}
      <WidgetTotal
        label={LABELS.sellBackResult}
        value={form.breakdown?.payout ?? null}
        tool="sellback"
      />
    </>
  );
}

function MazaneWidget() {
  const form = useMazaneForm();

  return (
    <>
      <WidgetField
        label={LABELS.mazane}
        name="widget-mazane-amount"
        value={form.values["amount"] ?? ""}
        onChange={(value) => form.setValue("amount", value)}
      />
      <WidgetTotal label={LABELS.mazaneResult} value={form.result} tool="mazane" />
    </>
  );
}

function CheapestWidget({ cheapest }: { cheapest: CheapestView }) {
  if (cheapest.priceDisplay === null) return <WidgetNote>{LABELS.noRail}</WidgetNote>;

  return (
    <>
      {cheapest.spreadDisplay !== null && (
        <div className="widget-tile widget-row">
          <span className="text-meta text-tx3">{LABELS.spread}</span>
          <TomanPrice value={cheapest.spreadDisplay} className="widget-num" />
        </div>
      )}
      <div className="widget-total widget-row">
        <span>
          {LABELS.cheapest}: <b data-widget-cheapest-name>{cheapest.name}</b>
        </span>
        <TomanPrice value={cheapest.priceDisplay} className="widget-num-accent" />
      </div>
    </>
  );
}

/**
 * ⚠️ The body is chosen by `href`, but the list itself still comes from
 * `homeActions` — a tool that ships without a widget body here falls back to
 * its own summary line rather than disappearing, and a widget can never
 * outlive the page it links to.
 */
function widgetBody(
  action: HomeAction,
  props: { pricePerGram: number | null; cheapest: CheapestView },
): ReactNode {
  if (action.href === "/mohasebe-tala") return <JewelryWidget pricePerGram={props.pricePerGram} />;
  if (action.href === "/mohasebe-forush-tala")
    return <SellBackWidget pricePerGram={props.pricePerGram} />;
  if (action.href === "/tabdil-mazane") return <MazaneWidget />;
  if (action.href === "/tala-18") return <CheapestWidget cheapest={props.cheapest} />;
  return <WidgetNote>{action.question}</WidgetNote>;
}

export type ToolWidgetIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

export function ToolWidget({
  action,
  icon: Icon,
  pricePerGram,
  cheapest,
}: {
  action: HomeAction;
  icon?: ToolWidgetIcon;
  pricePerGram: number | null;
  cheapest: CheapestView;
}) {
  const cta = (CTA as Record<string, string | undefined>)[action.href] ?? DEFAULT_CTA;

  return (
    <section data-home-action={action.href} className="card-surface widget-card">
      <div className="widget-head">
        {Icon !== undefined && (
          <span aria-hidden className="widget-icon">
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </span>
        )}
        <h2 className="widget-title">{action.title}</h2>
      </div>
      <p className="widget-sub">{action.question}</p>
      <div className="widget-body">{widgetBody(action, { pricePerGram, cheapest })}</div>
      <a href={action.href} data-widget-cta={action.href} className="widget-cta">
        {cta} ←
      </a>
    </section>
  );
}
