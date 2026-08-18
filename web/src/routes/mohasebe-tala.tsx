import { createFileRoute } from "@tanstack/react-router";

import { JewelryToolPage } from "@/components/content/JewelryToolPage";
import { JEWELRY_TOOL_BYLINE, JEWELRY_TOOL_FAQ, JEWELRY_TOOL_IDENTITY } from "@/lib/jewelry-tool";
import { loadJewelryToolData } from "@/lib/jewelry-tool-data";
import { toolPageHead } from "@/lib/tool-page";

export function jewelryToolHead() {
  return toolPageHead({
    identity: JEWELRY_TOOL_IDENTITY,
    faq: JEWELRY_TOOL_FAQ,
    byline: JEWELRY_TOOL_BYLINE,
  });
}

export const Route = createFileRoute("/mohasebe-tala")({
  loader: async () => loadJewelryToolData(),
  head: () => jewelryToolHead(),
  component: JewelryToolRoute,
});

function JewelryToolRoute() {
  return <JewelryToolPage data={Route.useLoaderData()} />;
}
