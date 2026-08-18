import { createServerFn } from "@tanstack/react-start";

import { withoutReferral } from "./page-data";
import type { InstrumentListing } from "./prices";
import type { Row } from "./rows";
import { fetchRowsForPlatforms, resolveSlug } from "./server/price-source";
import { WIZARD_ASSET_SLUG } from "./wizard";

export interface WizardPageData {
  listing: InstrumentListing | null;
  rows: Row[];
  generated_at: string;
}

export async function assembleWizardData(read: {
  resolveSlug: typeof resolveSlug;
  fetchRowsForPlatforms: typeof fetchRowsForPlatforms;
}): Promise<WizardPageData> {
  const resolved = await read.resolveSlug(WIZARD_ASSET_SLUG);
  const listing = resolved !== null && resolved.kind === "instrument" ? resolved.listing : null;
  const rows =
    listing === null ? [] : await read.fetchRowsForPlatforms(listing.supporting_platform_slugs);
  return {
    listing,
    rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
    generated_at: new Date().toISOString(),
  };
}

export const loadWizardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<WizardPageData> => assembleWizardData({ resolveSlug, fetchRowsForPlatforms }),
);
