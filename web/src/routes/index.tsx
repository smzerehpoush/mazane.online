/**
 * ⚠️ There is no client fetch for the first render: all the numbers come from
 * the loader (the server function `loadHomeData`) and are already in the
 * initial HTML. The business's number-one priority is SEO, and the crawler
 * must see the prices in the page source, not after JavaScript runs.
 */
import { createFileRoute } from "@tanstack/react-router";

import { HomePage, homeHead } from "@/components/tablo/HomePage";
import { loadHomeData } from "@/lib/home-data";

export const Route = createFileRoute("/")({
  loader: async () => loadHomeData(),
  head: () => homeHead(),
  component: Index,
});

function Index() {
  return <HomePage data={Route.useLoaderData()} />;
}
