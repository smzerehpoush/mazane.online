import type { ReactNode } from "react";

import { SiteHeader } from "@/components/tablo/SiteHeader";
import { legalNote } from "@/lib/site-content";

export function PageShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 70%)",
        }}
      />
      <SiteHeader />

      <main
        className={`mx-auto w-full px-4 py-6 sm:px-8 sm:py-8 ${
          wide ? "max-w-[1400px]" : "max-w-[820px]"
        }`}
      >
        {children}
      </main>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 text-[11px] leading-6 text-muted-foreground sm:px-8">
          {legalNote}
        </div>
      </footer>
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: readonly { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="مسیر صفحه" className="mb-4 text-[11px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden>/</span>}
            {item.href === undefined ? (
              <span aria-current="page" className="text-foreground/70">
                {item.label}
              </span>
            ) : (
              <a href={item.href} className="transition-smooth hover:text-primary">
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
