import type { Row } from "@/lib/rows";

export function AllPlatforms({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <nav aria-labelledby="all-platforms-heading" className="mt-8">
      <h2 id="all-platforms-heading" className="text-meta font-semibold text-muted-foreground">
        همه‌ی سکوها
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {rows.map((row) => (
          <li key={row.platform.slug}>
            <a
              href={`/${row.platform.slug}`}
              data-all-platform={row.platform.slug}
              className="transition-smooth text-meta text-tx3 hover:text-primary"
            >
              {row.platform.name_fa}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
