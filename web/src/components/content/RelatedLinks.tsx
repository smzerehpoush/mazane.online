import type { InternalLink } from "@/lib/tool-page";
import type { RelatedLinks } from "@/lib/clusters";

export function RelatedLinksBlock({
  links,
  toolPart,
  className = "mt-8",
}: {
  links: RelatedLinks;
  toolPart?: string;
  className?: string;
}) {
  const items: readonly InternalLink[] = [links.tools[0], links.tools[1], links.anchor, links.hub];
  return (
    <nav
      data-related-cluster={links.cluster}
      data-tool-part={toolPart}
      aria-label={links.heading}
      className={className}
    >
      <h2 className="text-lg font-semibold text-foreground">{links.heading}</h2>
      <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{links.lead}</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">
        {items.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              data-related-link={link.href}
              className="transition-smooth inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-foreground/80 hover:border-primary/40 hover:text-primary"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
