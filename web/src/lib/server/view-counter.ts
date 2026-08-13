import "@tanstack/react-start/server-only";

import {
  getViewCounts as readViewCounts,
  recordPostView as writePostView,
  setDefaultViewCounter,
  type ViewCounterSource,
  type ViewCounts,
} from "../views";
import { pgPool } from "./blog-source";

interface ViewRow {
  slug: string;
  views: string | number;
}

export function createPgViewCounter(): ViewCounterSource {
  const pool = pgPool();

  return {
    async recordView(slug: string): Promise<void> {
      await pool.query(
        `insert into post_views (slug, views, last_seen_at)
         values ($1, 1, now())
         on conflict (slug) do update
           set views = post_views.views + 1,
               last_seen_at = now()`,
        [slug],
      );
    },

    async viewCounts(): Promise<ViewCounts> {
      const result = await pool.query<ViewRow>("select slug, views from post_views");
      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.slug] = Number(row.views);
      }
      return counts;
    },
  };
}

let registered = false;

function ensureDefaultCounter(): void {
  if (registered) return;
  registered = true;
  setDefaultViewCounter(createPgViewCounter);
}

export async function recordPostView(slug: string): Promise<boolean> {
  ensureDefaultCounter();
  return writePostView(slug);
}

export async function getViewCounts(): Promise<ViewCounts> {
  ensureDefaultCounter();
  return readViewCounts();
}
