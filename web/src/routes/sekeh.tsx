import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/content/PageShell";
import { RelatedLinksBlock } from "@/components/content/RelatedLinks";
import { relatedLinksForPath } from "@/lib/clusters";
import type { CoinPriceKey } from "@/lib/coin-prices";
import { formatDateTimeFa } from "@/lib/format";
import { loadSekehData, type SekehPageData } from "@/lib/sekeh-data";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";

export const SEKEH_PATH = "/sekeh";

const TITLE = "قیمت سکه امامی، نیم سکه و ربع سکه — تابلو";
const DESCRIPTION =
  "قیمت لحظه‌ای انواع سکه در تابلو؛ سکه امامی، نیم سکه و ربع سکه همراه با توضیح کوتاه درباره‌ی کاربرد و تفاوت هرکدام.";

const COIN_EXPLAINERS: Record<CoinPriceKey, { tone: string; body: string }> = {
  emami: {
    tone: "معیار اصلی بازار سکه",
    body: "سکه امامی همان سکه تمام بهار آزادی طرح جدید است و معمولاً بیشترین توجه معامله‌گران را می‌گیرد. وقتی درباره‌ی حباب سکه یا جهت بازار سکه صحبت می‌شود، معمولاً این نرخ محور مقایسه است.",
  },
  half: {
    tone: "واحد میانی برای خرید سبک‌تر",
    body: "نیم سکه برای کسی مناسب است که می‌خواهد در بازار سکه بماند اما مبلغ کمتری نسبت به سکه تمام وارد کند. قیمت آن همیشه دقیقاً نصف سکه امامی نیست و می‌تواند حباب مستقل خودش را داشته باشد.",
  },
  quarter: {
    tone: "دسترسی خردتر با حساسیت بیشتر به تقاضا",
    body: "ربع سکه به‌خاطر مبلغ کمتر، در دوره‌های تقاضای خرد بیشتر دیده می‌شود. همین تقاضا می‌تواند باعث شود فاصله‌ی قیمت آن با ارزش طلای داخل سکه بیشتر از انتظار ساده‌ی وزنی باشد.",
  },
};

export function sekehHead() {
  return {
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/sekeh` }],
    scripts: [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: "قیمت سکه", url: `${SITE_URL}/sekeh` },
        ]),
      },
    ],
  };
}

export const Route = createFileRoute("/sekeh")({
  loader: async () => loadSekehData(),
  head: () => sekehHead(),
  component: SekehRoute,
});

function PriceText({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="text-[22px] font-semibold text-muted-foreground">—</span>;
  }
  return (
    <span className="num inline-flex items-baseline gap-2 text-[30px] leading-tight font-semibold tracking-[-0.7px] text-primary sm:text-[38px]">
      <span>{value}</span>
      <span className="text-[12px] font-normal tracking-normal text-muted-foreground sm:text-[13px]">
        تومان
      </span>
    </span>
  );
}

function CoinPriceBlock({ coin }: { coin: SekehPageData["coins"][number] }) {
  const explainer = COIN_EXPLAINERS[coin.key];
  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-border bg-surface p-5 shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-card">
      <div
        aria-hidden
        className="absolute inset-y-4 right-0 w-1 rounded-l-full bg-primary/70 transition-smooth group-hover:bg-gold"
      />
      <div className="pr-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">{coin.label}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{explainer.tone}</p>
          </div>
          <span className="rounded-full bg-gold-soft px-3 py-1 text-[11px] font-medium text-gold">
            قیمت زنده
          </span>
        </div>
        <div className="mt-5">
          <PriceText value={coin.priceDisplay} />
        </div>
        <p className="mt-4 text-[13px] leading-7 text-foreground/80">{explainer.body}</p>
        <p className="mt-4 text-[11px] text-muted-foreground">
          آخرین ثبت:{" "}
          {coin.readAt === null ? (
            "هنوز داده‌ای ثبت نشده است"
          ) : (
            <time dateTime={coin.readAt}>{formatDateTimeFa(coin.readAt)}</time>
          )}
        </p>
      </div>
    </article>
  );
}

export function SekehPage({ data }: { data: SekehPageData }) {
  const pricedCoins = data.coins.filter((coin) => coin.priceToman !== null);
  const leadPrice = pricedCoins[0] ?? data.coins[0] ?? null;

  return (
    <PageShell wide>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "قیمت سکه" }]} />

      <section className="glass-surface overflow-hidden px-5 py-7 sm:px-8 sm:py-9">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-end">
          <div>
            <p className="text-[12px] font-medium tracking-[0.18em] text-gold">تابلوی سکه</p>
            <h1 className="mt-3 text-[30px] leading-[1.35] font-black text-foreground sm:text-[42px]">
              قیمت سکه امامی، نیم سکه و ربع سکه
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-8 text-foreground/78">
              این صفحه نرخ‌های اصلی بازار سکه را کنار هم می‌گذارد تا تفاوت اندازه‌ی معامله،
              نقدشوندگی و رفتار حباب در هر نوع سکه ساده‌تر دیده شود. عددها برای مقایسه‌ی سریع‌اند،
              نه توصیه‌ی خرید یا فروش.
            </p>
          </div>
          <div className="rounded-[26px] border border-gold/25 bg-gold-soft/60 p-5">
            <p className="text-[12px] text-muted-foreground">شاخص روی صفحه</p>
            <div className="mt-2">
              {leadPrice === null ? "—" : <PriceText value={leadPrice.priceDisplay} />}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {leadPrice?.label ?? "قیمت سکه"} به‌عنوان اولین نرخ قابل نمایش
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        {data.coins.map((coin) => (
          <CoinPriceBlock key={coin.key} coin={coin} />
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="card-surface px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-foreground">چرا قیمت سکه با طلای خام فرق دارد؟</h2>
          <p className="mt-3 text-[14px] leading-8 text-foreground/80">
            قیمت سکه فقط وزن طلای داخل آن نیست. ضرب، عرضه، تقاضای خرد، انتظار بازار و حباب می‌تواند
            باعث شود قیمت هر نوع سکه با ارزش طلای خام داخلش فاصله بگیرد. به همین دلیل نیم سکه و ربع
            سکه همیشه با نسبت ساده‌ی وزنی از سکه امامی حرکت نمی‌کنند.
          </p>
        </div>
        <div className="card-surface px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-foreground">چطور از این صفحه استفاده کنم؟</h2>
          <ul className="mt-3 list-disc space-y-2 pr-5 text-[14px] leading-8 text-foreground/80">
            <li>برای دیدن جهت کلی بازار، ابتدا سکه امامی را نگاه کنید.</li>
            <li>برای خرید سبک‌تر، نیم سکه و ربع سکه را جداگانه بررسی کنید.</li>
            <li>
              اگر فاصله‌ی قیمت‌ها غیرعادی به نظر می‌رسد، حباب و تقاضای همان نوع سکه را جدی بگیرید.
            </li>
          </ul>
        </div>
      </section>

      <RelatedLinksBlock
        links={relatedLinksForPath(SEKEH_PATH)}
        className="card-surface mt-5 px-5 py-5 sm:px-6"
      />
    </PageShell>
  );
}

function SekehRoute() {
  return <SekehPage data={Route.useLoaderData()} />;
}
