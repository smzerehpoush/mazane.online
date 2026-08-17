import type { BubbleView } from "@/lib/bubble";
import type { CoinPricesView } from "@/lib/coin-prices";
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";

function BubbleValue({
  label,
  value,
  unit,
  attr,
}: {
  label: string;
  value: string | null;
  unit: "toman" | "percent";
  attr: "data-bubble-intrinsic" | "data-bubble-amount" | "data-bubble-percent";
}) {
  return (
    <div className="rounded-[10px] bg-surface px-2 py-2.5 text-center">
      <span className="text-[11px] text-tx3">{label}</span>
      <b {...{ [attr]: true }} className="mt-0.5 block text-[14.5px] font-semibold text-foreground">
        {unit === "toman" ? (
          <span className="inline-flex items-baseline justify-center gap-1">
            <span data-price-value>{value ?? "—"}</span>
            <span
              data-price-unit
              className={`text-[9px] font-normal tracking-normal text-muted-foreground ${
                value === null ? "hidden" : ""
              }`}
            >
              تومان
            </span>
          </span>
        ) : (
          (value ?? "—")
        )}
      </b>
    </div>
  );
}

function riskClassName(riskLevel: BubbleView["riskLevel"] | null): string {
  if (riskLevel === "HIGH") return "bg-rdbg text-rdtx";
  if (riskLevel === "MEDIUM") return "bg-ambg text-am";
  if (riskLevel === "LOW") return "bg-gnbg text-gntx";
  return "bg-muted text-muted-foreground";
}

export function BubbleGauge({ bubble }: { bubble: BubbleView | null }) {
  const riskLevel = bubble?.riskLevel ?? null;

  return (
    <section data-card="bubble" className="card-surface px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15.5px] font-semibold">حباب سنج</h2>
        <span
          data-bubble-risk-label
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${riskClassName(
            riskLevel,
          )}`}
        >
          {bubble?.riskLabel ?? "نامشخص"}
        </span>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2.5">
        <BubbleValue
          label="قیمت ذاتی"
          value={bubble?.intrinsicDisplay ?? null}
          unit="toman"
          attr="data-bubble-intrinsic"
        />
        <BubbleValue
          label="مقدار حباب"
          value={bubble?.bubbleDisplay ?? null}
          unit="toman"
          attr="data-bubble-amount"
        />
        <BubbleValue
          label="درصد حباب"
          value={bubble?.bubblePercentDisplay ?? null}
          unit="percent"
          attr="data-bubble-percent"
        />
      </div>
      <div
        data-bubble-status-panel
        className={`mt-3 rounded-[10px] px-3 py-2.5 text-center text-[12.5px] ${riskClassName(
          riskLevel,
        )}`}
      >
        <span className="font-medium">سطح ریسک: </span>
        <span data-bubble-status>
          {bubble === null ? "داده اونس یا دلار هنوز در دسترس نیست" : bubble.riskDescription}
        </span>
      </div>
    </section>
  );
}

export function CoinPriceCard({ coins }: { coins: CoinPricesView }) {
  return (
    <section data-card="coin-prices" className="card-surface px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15.5px] font-semibold">قیمت سکه</h2>
      </div>
      <div className="mt-3.5 grid gap-2.5">
        {coins.map((coin) => (
          <div
            key={coin.key}
            className="flex items-center justify-between gap-3 rounded-[10px] bg-surface px-3 py-2.5"
          >
            <span className="text-[12.5px] text-tx3">{coin.label}</span>
            <b
              data-coin-price={coin.key}
              className="num inline-flex items-baseline gap-1 text-[14.5px] font-semibold text-foreground"
            >
              <span data-price-value>{coin.priceDisplay ?? "—"}</span>
              <span
                data-price-unit
                className={`text-[9px] font-normal tracking-normal text-muted-foreground ${
                  coin.priceDisplay === null ? "hidden" : ""
                }`}
              >
                تومان
              </span>
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

export { JewelryCalculator };
