import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundPanel } from "@/components/content/NotFoundPanel";
import { PageShell } from "@/components/content/PageShell";
import { SlugPageView, slugHead } from "@/components/content/SlugPageView";
import {
  comparisonSearchOf,
  comparisonViewFromSearch,
  normalizeComparisonFilters,
  normalizeComparisonSort,
  type ComparisonFilter,
  type ComparisonSort,
} from "@/lib/comparison-table";
import { loadSlugPage } from "@/lib/content-data";

interface SlugSearch {
  sort?: ComparisonSort;
  filter?: string;
}

/**
 * ⚠️ The comparison view lives in the URL so the table sorts and filters with
 * JavaScript switched off — the server renders the requested view directly.
 * The default view serializes to no query string at all, and `slugHead` keeps
 * the canonical at `/<slug>`, so the variants never compete in the index.
 */
export const Route = createFileRoute("/$slug")({
  validateSearch: (search: Record<string, unknown>): SlugSearch => {
    const sort = normalizeComparisonSort(search["sort"]);
    const filters: ComparisonFilter[] = normalizeComparisonFilters(search["filter"]);
    return comparisonSearchOf({ sort, filters });
  },
  loader: async ({ params }) => {
    const data = await loadSlugPage({ data: { slug: params.slug } });
    if (data === null) throw notFound();
    return data;
  },
  head: ({ loaderData }) => slugHead(loaderData),
  component: SlugPage,
  notFoundComponent: () => (
    <PageShell>
      <NotFoundPanel />
    </PageShell>
  ),
});

function SlugPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PageShell wide>
      <SlugPageView
        data={Route.useLoaderData()}
        view={comparisonViewFromSearch(search)}
        onViewChange={(next) => {
          void navigate({ search: comparisonSearchOf(next), replace: true });
        }}
      />
    </PageShell>
  );
}
