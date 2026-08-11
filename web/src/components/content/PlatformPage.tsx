/**
 * صفحه‌ی سکو (بلیت ۷؛ بند ۱۳، تصمیم ۴ — بازچینش بلیت ۳۲): «قیمت امروز» (دو
 * کارت مؤثر خرید/فروش + کارمزد، فقط برای سکوی کارمزدمعلوم)، تحویل فیزیکی،
 * هویت حقوقی و لینک وب‌سایت.
 *
 * فراداده (website_url، legal_entity، delivery_note_fa، min_order_toman) همان
 * است که گردآورنده از سند تحقیق ۰۱ پر کرده؛ جای نامستند صادقانه «ثبت نشده
 * است» می‌گوید — **هیچ مقداری حدس زده نمی‌شود**. اعداد همه آماده‌ی
 * گردآورنده‌اند (قاعده‌ی ۱).
 *
 * قطع منبع ⟸ صفحه ۲۰۰ می‌ماند و فقط «قیمت در دسترس نیست» می‌گوید (قاعده‌ی ۵).
 *
 * بلیت ۲۶: صفحه فقط طلای ۱۸ عیار را نشان می‌دهد — جدول «قیمت‌های این سکو»ی
 * قبلی (همه‌ی دارایی‌ها) حذف شده؛ آن عدد در کارت قهرمان (بلیت ۲۷) از قبل
 * هست.
 *
 * بلیت ۳۵: زیر «قیمت امروز» یک ماشین‌حساب دوحالته می‌آید
 * (`PlatformCalculator.tsx`) — کارمزدمعلوم دو ورودی دوسویه‌ی خرید/فروش،
 * کارمزد نامعلوم فقط یک ورودی وزن روی قیمت اسمی. جزئیاتش همان‌جاست.
 */
import type { ReactNode } from "react";

import { Madde5Bar } from "@/components/content/LegalNotice";
import { PlatformCalculator } from "@/components/content/PlatformCalculator";
import { PlatformRateCard } from "@/components/content/PlatformRateCard";
import {
  ClosedBadges,
  FeeSourceLabel,
  MarketModelBadge,
  Staleness,
} from "@/components/content/RowParts";
import { formatDateTimeFa, formatDateFa, formatPercentPointsFa, formatToman } from "@/lib/format";
import type { PlatformHistoryByRange } from "@/lib/history";
import type { ListedPlatform, PlatformSnapshot } from "@/lib/prices";
import type { ReferencePrice } from "@/lib/reference-price";
import { priceToman, type Row } from "@/lib/rows";

const NOT_RECORDED = "ثبت نشده است";
const UNKNOWN = "نامشخص";

/**
 * توضیح ستون قیمت (سند تصمیم ۰۰۰۲): عدد درشت **آنچه می‌پردازید نیست** —
 * کارمزد جدا زیرش می‌آید و در قیمت ضرب نشده. بدون این جمله، کاربر عدد
 * پیش-از-کارمزد را هزینه‌ی خرید می‌خواند.
 */
const PRICE_EXPLANATION_FA =
  "این عدد قیمت اعلامی همین سکوست، پیش از کارمزد. آنچه می‌پردازید یا می‌گیرید، به کارمزد خرید و فروش زیر بستگی دارد.";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] leading-6">{children}</dd>
    </div>
  );
}

/** کارت «قیمت» — عدد آماده‌ی گردآورنده، بدون هیچ محاسبه‌ای. */
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

/**
 * نوار «نرخ اتحادیه» (تیکت ۳۳) — عدد ۱۸ عیارِ مرجع قیمت، مستقل از این سکو.
 *
 * برچسب «اتحادیه» روی عددی که واقعاً از تلا خوانده می‌شود، تصمیم ثبت‌شده‌ی
 * مالک است — سند `docs/adr/0001-etehadieh-label-on-talair-number.md`. این
 * عدد در هیچ محاسبه‌ای شرکت نمی‌کند و هرگز به‌عنوان قیمت این یا هیچ سکوی
 * دیگری نمایش داده نمی‌شود (قاعده‌ی ۴ قراردادها: بدون میانگین بین‌سکویی).
 *
 * قطع منبع مرجع ⟸ `referencePrice` تهی است و نوار اصلاً رندر نمی‌شود؛ صفحه
 * همچنان ۲۰۰ می‌ماند (قاعده‌ی ۵).
 */
function UnionRateBar({ referencePrice }: { referencePrice: ReferencePrice | null }) {
  if (referencePrice === null) return null;
  return (
    <p
      data-union-rate
      className="glass-surface mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-[12px]"
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

/**
 * «قیمت امروز» — حالا برای **همه‌ی** سکوها رندر می‌شود، از جمله
 * کارمزدنامعلوم‌ها (سند تصمیم ۰۰۰۲). پیش‌تر آن چهار سکو این بخش را اصلاً
 * نمی‌گرفتند چون قیمت مؤثر برایشان وجود نداشت؛ حالا قیمتشان با بقیه
 * هم‌جنس است و فقط ردیف‌های کارمزد «نامشخص» می‌مانند — و «نامشخص» یعنی
 * اعلام‌نشده، نه صفر.
 */
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
  const minOrder = terms.min_order_toman ?? null;
  const dateLabel = updatedAt === null ? null : formatDateFa(updatedAt);

  return (
    <section aria-labelledby="terms-heading" className="glass-surface px-5 py-5 sm:px-6">
      <h2 id="terms-heading" className="text-base font-semibold sm:text-lg">
        قیمت امروز{dateLabel === null ? null : ` — ${dateLabel}`}
      </h2>

      <div className="mt-4">
        <PriceCard toman={price} />
      </div>

      <p className="mt-4 text-[12px] leading-6 text-muted-foreground">
        {PRICE_EXPLANATION_FA}
      </p>

      <dl className="mt-3">
        <Field label="کارمزد خرید">
          {terms.buy_fee_percent === null ? UNKNOWN : formatPercentPointsFa(terms.buy_fee_percent)}
        </Field>
        <Field label="کارمزد فروش">
          {terms.sell_fee_percent === null
            ? UNKNOWN
            : formatPercentPointsFa(terms.sell_fee_percent)}
        </Field>
        <Field label="هزینه‌ی رفت‌وبرگشت">
          {terms.round_trip_percent === null
            ? UNKNOWN
            : formatPercentPointsFa(terms.round_trip_percent)}
        </Field>
        <Field label="منبع کارمزد">
          <FeeSourceLabel terms={terms} />
        </Field>
        <Field label="حداقل سفارش">
          <span data-min-order>
            {minOrder === null ? NOT_RECORDED : `${formatToman(Number(minOrder))} تومان`}
          </span>
        </Field>
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
  /** تاریخچه‌ی همین سکو، هر سه بازه — کارت نرخ بالای صفحه (بلیت ۲۷ + ۳۰). */
  history: PlatformHistoryByRange;
  /** نوار «نرخ اتحادیه» (تیکت ۳۳) — مرجع قیمت مستقل، نه قیمت این سکو. */
  referencePrice: ReferencePrice | null;
  nowMs: number;
}) {
  // ردیف دامنه‌ی همین سکو — تنها مصرفش انتخاب «قیمت مرجع سکو» است.
  const row: Row = { platform, snapshot, updatedAt };

  return (
    <>
      {/* قهرمان (سند مادر #26، بند ۲): دو ستونه در دسکتاپ — راست متن،
          چپ کارت نرخ؛ در موبایل روی هم، **اول کارت نمودار، بعد متن**.
          ترتیب DOM همان ترتیب دیده‌شده‌ی دسکتاپ است (راست‌به‌چپ با
          dir="rtl" یعنی اولین فرزند DOM ستون راست می‌شود)؛ کلاس‌های
          order فقط زیر lg این ترتیب را برای موبایل برعکس می‌کنند. */}
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
              {/* بلیت ۹ (تصمیم ۲۱): هر کلیک خروجی درآمدزا از ‎/go/<slug>‎ می‌گذرد —
                  کد معرف فقط سمت ریدایرکت است و هرگز در HTML نمی‌نشیند. rel کامل
                  الزام بند ۶.۴ است و تست CI دارد. */}
              <a
                href={`/go/${platform.slug}`}
                rel="sponsored nofollow noopener"
                target="_blank"
                data-outbound="website"
                className="transition-smooth inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {/* متن دکمه‌ی اصلی: عیناً تصمیم مالک (سند مادر #26، سؤال «متن
                    دکمه‌ی اصلی چه باشد؟») — «ورود و شروع معامله»، بدون نام سکو؛
                    نوار ماده ۵ زیرِ صفحه و نشانه‌ی خروج (target=_blank) صراحت
                    می‌دهند که کاربر از سایت خارج می‌شود. دکمه‌ی جداگانه‌ی
                    ماشین‌حساب (بلیت ۳۵) نام سکو را دارد چون به یک معامله‌ی
                    مشخص‌شده ارجاع می‌دهد، نه این دکمه‌ی عمومی بالای صفحه. */}
                ورود و شروع معامله
              </a>
            </p>
          )}
        </header>

        {/* بلیت ۲۷: عدد درشت خودش وقتی قیمت مرجع نداریم (کارت null برمی‌گرداند)
            چیزی نمی‌گذارد؛ پیام «قیمت در دسترس نیست» زیرش همچنان می‌آید. */}
        <div className="order-1 lg:order-none">
          <PlatformRateCard row={row} history={history} nowMs={nowMs} />
        </div>
      </div>

      <UnionRateBar referencePrice={referencePrice} />

      {snapshot === null ? (
        // قطع منبع ⟸ کهنگی، نه خطا: صفحه ۲۰۰ می‌ماند (قاعده‌ی ۵ قراردادها).
        <p className="glass-surface px-5 py-8 text-center text-sm text-muted-foreground">
          قیمت در دسترس نیست
        </p>
      ) : (
        // بلیت ۳۲: «قیمت امروز» فقط برای کارمزدمعلوم می‌آید — کارمزد نامعلوم
        // یعنی TermsSection خودش null برمی‌گرداند، نه حدسی از اینجا.
        <TermsSection row={row} snapshot={snapshot} updatedAt={updatedAt} />
      )}

      {/* بلیت ۳۵: ماشین‌حساب زیر «قیمت امروز» — خودش هم قطع منبع (snapshot
          null) و هم کارمزد نامعلوم را از روی همان row تشخیص می‌دهد، حدسی از
          اینجا لازم نیست. */}
      <PlatformCalculator row={row} hasOutbound={hasOutbound} />

      <section aria-labelledby="identity-heading" className="glass-surface mt-6 px-5 py-5 sm:px-6">
        <h2 id="identity-heading" className="text-base font-semibold sm:text-lg">
          هویت و تحویل فیزیکی
        </h2>
        <dl className="mt-3">
          <Field label="هویت حقوقی">
            <span data-legal-entity>{platform.legal_entity ?? NOT_RECORDED}</span>
          </Field>
          <Field label="تحویل فیزیکی">
            <span data-delivery-note>{platform.delivery_note_fa ?? NOT_RECORDED}</span>
          </Field>
        </dl>
      </section>

      <p className="mt-6 text-[12px]">
        <a href="/" className="transition-smooth text-primary hover:underline">
          بازگشت به جدول مقایسه
        </a>
      </p>

      {/* بند ۷.۲: صفحه‌ی ارجاع است (لینک /go/ بالای صفحه) ⟸ نوار ماده ۵. */}
      <Madde5Bar />
    </>
  );
}
