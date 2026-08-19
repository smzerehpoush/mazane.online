import { ThemeToggle } from "@/components/tablo/ThemeToggle";
import { brand, MAIN_LANDMARK_ID, nav, skipToContentLabel } from "@/lib/site-content";

export function SiteHeader() {
  return (
    <header className="z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl sm:sticky sm:top-0">
      <a
        href={`#${MAIN_LANDMARK_ID}`}
        data-skip-link
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-4 focus:z-50 focus:rounded-full focus:border focus:border-primary focus:bg-background focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-primary"
      >
        {skipToContentLabel}
      </a>
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex sm:justify-between sm:gap-4 sm:px-8 sm:py-3">
        <a href="/" className="order-1 flex min-h-11 items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-[14px] border border-gold/35 bg-surface shadow-soft">
            <img src="/tablo-logo-mark.png" alt="" className="size-8 object-contain" />
          </span>
          <span className="whitespace-nowrap text-body font-bold sm:text-title">{brand.name}</span>
        </a>
        <nav
          aria-label="ناوبری اصلی"
          className="order-3 col-span-2 grid min-w-0 grid-cols-3 gap-2 min-[500px]:grid-cols-5 sm:order-2 sm:col-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-1"
        >
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition-smooth flex min-h-11 items-center justify-center rounded-full border border-border/60 bg-surface/70 px-2.5 py-2 text-center text-meta whitespace-nowrap text-muted-foreground hover:bg-surface-2 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:min-h-9 sm:border-transparent sm:bg-transparent sm:px-3 sm:py-1.5"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="order-2 sm:order-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
