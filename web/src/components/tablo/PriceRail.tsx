/**
 * ⚠️ **بدون جاوااسکریپت هم کار می‌کند**: موقعیت هر نشانگر در همان صفت `style`
 * سروررندر است و قیمت‌ها متن ساده‌اند. انیمیشن، فتیله و پولینگ لایه‌ی اضافه‌اند
 * که با JS خاموش صرفاً غایب‌اند — نه اینکه صفحه خالی شود.
 */
import { useEffect, useRef } from "react";

import type { RailView } from "@/lib/dashboard";

const STEM_LONG_PX = 38;
const STEM_SHORT_PX = 10;

export function PriceRail({
  rail,
  updatedAt,
  updatedAtDisplay,
  tick,
  failed,
  onRefresh,
}: {
  rail: RailView;
  updatedAt: string | null;
  updatedAtDisplay: string | null;
  tick: number;
  failed: boolean;
  onRefresh: () => void;
}) {
  const fuseRef = useRef<HTMLDivElement | null>(null);

  /** ⚠️ فقط بعد از mount: `Date.now` در رندر سرور ممنوع است. */
  useEffect(() => {
    const fuse = fuseRef.current;
    if (fuse === null) return;

    if (updatedAt === null) {
      fuse.style.animation = "none";
      return;
    }

    /**
     * ⚠️ با شکست فچ فتیله باید **بایستد**. این تزئین نیست — فتیله‌ی
     * در حال سوختن یک وعده است: «تمام که شد، قیمت‌ها تازه می‌شوند» (همان متن
     * زیر عنوان کارت). وقتی اتصال قطع است این وعده دروغ می‌شود و بدتر از
     * نبودنش است: کاربر عددِ کهنه را تازه می‌پندارد. نوار خطا به‌تنهایی کافی
     * نیست، چون فتیله همچنان هر ۳۰ ثانیه پر و خالی می‌شود و حرکت، از متن
     * ساکن قوی‌تر دیده می‌شود.
     */
    if (failed) {
      fuse.style.animationPlayState = "paused";
      return;
    }

    const elapsedSeconds = (Date.now() - new Date(updatedAt).getTime()) / 1000;
    const remaining = Math.max(0, 30 - (elapsedSeconds % 30));

    fuse.style.animation = "none";
    void fuse.offsetWidth;
    fuse.style.animation = "";
    fuse.style.animationDelay = `-${30 - remaining}s`;
    fuse.style.animationPlayState = "running";
  }, [updatedAt, tick, failed]);

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15.5px] font-semibold">محور قیمت طلای ۱۸ عیار</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            هرچه راست‌تر، ارزان‌تر · خط طلایی که تمام شود، قیمت‌ها تازه می‌شوند
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={onRefresh}
            data-rail-refresh
            className="transition-smooth text-[12.5px] font-medium text-primary hover:underline"
          >
            همین حالا بگیر ↻
          </button>
          {updatedAt !== null && (
            <span className="text-[10.5px] text-tx3">
              آخرین به‌روزرسانی{" "}
              <time dateTime={updatedAt} data-rail-updated className="num">
                {updatedAtDisplay}
              </time>
            </span>
          )}
        </div>
      </div>

      {failed && (
        <p
          data-rail-error
          role="status"
          className="mx-5 mb-1 rounded-[10px] bg-ambg px-3 py-2 text-[11.5px] text-am sm:mx-6"
        >
          اتصال برقرار نیست — تلاش مجدد
        </p>
      )}

      {rail.hasRail ? (
        <>
          {/*
           * ⚠️ `mx` روی موبایل الزامی است، نه تزئین: نشانگر با
           * `translateX(50%)` وسط‌چین می‌شود، پس نشانگرِ لبه (۴٪ و ۹۶٪) نیمی
           * از برچسبش بیرون از کادر می‌افتد. اندازه‌گیری در ۳۷۵px: طلاسی تا
           * ۳۷۸px و وال‌گلد تا ‎−۳px‎ می‌رفتند.
           * padding کار نمی‌کند — درصدِ عنصر absolute نسبت به **padding box**
           * حل می‌شود و padding آن را تو نمی‌برد؛ margin می‌برد.
           * ارتفاع بیشتر روی موبایل خواسته‌ی خودِ است (≤620px).
           */}
          <div data-rail className="relative mx-7 mt-3 h-[180px] sm:mx-0 sm:h-[132px]">
            <div className="absolute top-[30px] right-[4%] left-[4%] h-px bg-line2">
              <div
                ref={fuseRef}
                data-rail-fuse
                aria-hidden
                className="rail-fuse absolute top-[-1px] right-0 h-[3px] rounded-[2px] bg-gold"
              />
            </div>

            {rail.referencePercent !== null && (
              <>
                <div
                  aria-hidden
                  data-rail-anchor
                  className="rail-anchor absolute top-2 bottom-1.5 w-0 border-r border-dashed border-primary opacity-45"
                  style={{ right: `${rail.referencePercent}%` }}
                />
                <span
                  data-rail-anchor-label
                  className="rail-anchor absolute top-0 translate-x-1/2 rounded-[20px] bg-acbg px-2 py-0.5 text-[10.5px] whitespace-nowrap text-actx"
                  style={{ right: `${rail.referencePercent}%` }}
                >
                  قیمت مرجع
                </span>
              </>
            )}

            {rail.sources.map((source) =>
              source.railPercent === null ? null : (
                <a
                  /** ⚠️ کلید = اسلاگ. هر چیز دیگری یعنی re-mount و مرگ ترنزیشن. */
                  key={source.slug}
                  href={source.href}
                  rel="sponsored nofollow noopener"
                  target="_blank"
                  data-outbound="price-rail"
                  data-rail-marker={source.slug}
                  aria-label={source.ariaLabel}
                  className="rail-marker absolute top-6 flex translate-x-1/2 flex-col items-center text-inherit no-underline"
                  style={{ right: `${source.railPercent}%` }}
                >
                  <span
                    className="size-[13px] rounded-full border-[2.5px] bg-card transition-transform duration-200 group-hover:scale-125"
                    style={{ borderColor: source.color }}
                  />
                  <span
                    data-rail-stem
                    className="w-px bg-line2"
                    style={{ height: `${source.stemLong ? STEM_LONG_PX : STEM_SHORT_PX}px` }}
                  />
                  <span className="mt-[5px] text-xs whitespace-nowrap">{source.name}</span>
                  <span data-rail-price className="num text-[11.5px] whitespace-nowrap text-tx3">
                    {source.priceDisplay}
                  </span>
                </a>
              ),
            )}
          </div>

          {/*
           * ⚠️ ترتیب DOM اینجا معنادار است: در RTL، **اولین** فرزندِ
           * justify-between سمت راست می‌نشیند. «ارزان‌تر» باید سمت راست
           * بیاید تا با جای نشانگرها بخواند. جابه‌جا کردن این دو
           * یعنی پاورقی خلاف خودِ محور حرف بزند.
           */}
          <div className="mx-5 flex items-center justify-between border-t border-border pt-3 pb-4 text-[11.5px] text-tx3 sm:mx-6">
            <span data-rail-min>{rail.minDisplay} · ارزان‌تر</span>
            <span data-rail-spread className="text-muted-foreground">
              بازه اختلاف {rail.spreadDisplay} تومان
            </span>
            <span data-rail-max>گران‌تر · {rail.maxDisplay}</span>
          </div>
        </>
      ) : (
        <p className="px-5 pb-5 text-xs leading-6 text-muted-foreground sm:px-6">
          برای رسم محور دست‌کم دو سکوی قیمت‌دار لازم است. قیمت‌های موجود در کارت‌های پایین در
          دسترس‌اند.
        </p>
      )}
    </section>
  );
}
