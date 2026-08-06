import { brand, nav } from "@/lib/site-content";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full border border-gold/40 bg-gold-soft text-[13px] font-bold text-foreground/80 shadow-soft">
            م
          </span>
          <span className="whitespace-nowrap text-sm font-bold sm:text-base">{brand.name}</span>
        </a>
        <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition-smooth shrink-0 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-surface-2 hover:text-primary sm:text-xs"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
