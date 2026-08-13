import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundPanel } from "@/components/content/NotFoundPanel";
import { PageShell } from "@/components/content/PageShell";
import { SlugPageView, slugHead } from "@/components/content/SlugPageView";
import { loadSlugPage } from "@/lib/content-data";

export const Route = createFileRoute("/$slug")({
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
  return (
    <PageShell wide>
      <SlugPageView data={Route.useLoaderData()} />
    </PageShell>
  );
}
