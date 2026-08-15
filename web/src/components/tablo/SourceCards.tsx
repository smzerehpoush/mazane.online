/**
 * ⚠️ **The badge carries no percent difference.** The initial design put
 * `−1.23%` on every non-reference card; that number was removed and is
 * computed neither here nor anywhere else. The only badge left is
 * "reference price", which is a **label**, not a number.
 * ⚠️ Every card goes to `/go/<slug>` with
 * `rel="sponsored nofollow noopener"` and `target="_blank"` — never
 * straight to the platform's domain. The destination is built in
 * `dashboard.ts` and is guarded by CI.
 */
import { Staleness } from "@/components/content/RowParts";
import type { RailSource } from "@/lib/dashboard";

export function SourceCards({ sources, nowMs }: { sources: RailSource[]; nowMs: number }) {
  return (
    <section className="card-surface overflow-hidden px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-[15.5px] font-semibold">منابع قیمت</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">روند ۲۴ ساعت گذشته‌ی هر سکو</p>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-[11px] sm:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        {sources.map((source) => (
          <a
            key={source.slug}
            href={source.href}
            rel="sponsored nofollow noopener"
            target="_blank"
            data-outbound="source-card"
            data-source-card={source.slug}
            className="transition-smooth block rounded-[11px] border border-transparent bg-surface p-3 pb-2.5 text-inherit no-underline hover:border-line2"
          >
            <span className="mb-2 flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: source.color }}
              />
              <span className="truncate text-xs text-muted-foreground">{source.name}</span>
            </span>

            <div data-source-price className="num text-base font-semibold tracking-[-0.3px]">
              {source.priceDisplay ?? (
                <span className="text-[12.5px] font-normal text-muted-foreground">
                  قیمت در دسترس نیست
                </span>
              )}
            </div>

            <span className="my-1.5 mb-2.5 flex h-[18px] items-center">
              {source.isReference && (
                <span className="rounded-[20px] bg-acbg px-[7px] py-px text-[10.5px] text-actx">
                  قیمت مرجع
                </span>
              )}
            </span>

            {/*
             * ⚠️ Staleness label per **platform** — not page-level. The
             * label above the rail is the max age across all platforms, so
             * one dead platform hides behind the freshness of the rest; the
             * old table had this per row and it got lost when that was
             * removed.
             * `nowMs` comes from the server's `generated_at`, not
             * `Date.now`, so hydration doesn't diverge.
             */}
            <div className="mb-1.5 text-[10px]">
              <Staleness updatedAt={source.updatedAt} nowMs={nowMs} />
            </div>

            {source.sparkline.line === null ? (
              <div aria-hidden className="h-7 w-full" />
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 100 32"
                preserveAspectRatio="none"
                className="block h-7 w-full"
              >
                <path d={source.sparkline.area ?? ""} fill={source.color} fillOpacity=".1" />
                <path
                  d={source.sparkline.line}
                  fill="none"
                  stroke={source.color}
                  strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
