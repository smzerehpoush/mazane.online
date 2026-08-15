import { ThemeToggle } from "@/components/tablo/ThemeToggle";
import { brand, nav } from "@/lib/site-content";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-[14px] border border-gold/35 bg-surface shadow-soft">
            <img src="/tablo-logo-mark.png" alt="" className="size-8 object-contain" />
          </span>
          <span className="whitespace-nowrap text-sm font-bold sm:text-base">{brand.name}</span>
        </a>
        <div className="flex min-w-0 items-center gap-2">
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
