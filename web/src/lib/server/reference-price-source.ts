import "@tanstack/react-start/server-only";

import {
  getReferencePrice as readReferencePrice,
  setDefaultReferencePriceSource,
  type ReferencePrice,
  type ReferencePriceQuery,
  type ReferencePriceSource,
} from "../reference-price";
import { pgPool } from "./blog-source";

interface RollupRow {
  hour_start: Date;
  close_value: string;
}

const SQL = `
  select hour_start, close_value
    from hourly_rollups
   where kind = 'REFERENCE'
     and source_slug = $1
     and instrument = $2
     and side = 'PRICE'
   order by hour_start desc
   limit 1
`;

export function createPgReferencePriceSource(): ReferencePriceSource {
  const pool = pgPool();

  return {
    async getReferencePrice(query: ReferencePriceQuery): Promise<ReferencePrice | null> {
      const result = await pool.query<RollupRow>(SQL, [query.referenceSlug, query.instrument]);
      const row = result.rows[0];
      if (row === undefined) return null;
      return {
        reference_slug: query.referenceSlug,
        instrument: query.instrument,
        value: Number(row.close_value),
        read_at: row.hour_start.toISOString(),
      };
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultReferencePriceSource(createPgReferencePriceSource);
}

export async function getReferencePrice(
  query: ReferencePriceQuery,
): Promise<ReferencePrice | null> {
  ensureDefaultSource();
  return readReferencePrice(query);
}
