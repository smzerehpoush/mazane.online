/**
 * ⚠️ Postgres only — the panel never writes to Redis. The collector picks the
 * profile up in the same ~20 second settings sync as `platform_settings`
 * (`tablo_collector.settings`), merges it onto the live registry, and the web
 * layer sees it through `tablo:listed`. Writing here and expecting the page to
 * change on the next request is a misunderstanding, not a bug.
 */
import "@tanstack/react-start/server-only";

import {
  loadPlatformProfiles as domainLoad,
  savePlatformProfiles as domainSave,
  setDefaultPlatformProfilesSource,
  type FaqItem,
  type KycLevel,
  type MobileApp,
  type PaymentMethod,
  type PlatformProfileEntry,
  type PlatformProfilesSource,
} from "../platform-profile";
import { pgPool } from "./blog-source";

interface ProfileRow {
  slug: string;
  payment_methods: string[] | null;
  kyc_level: string | null;
  mobile_app: string | null;
  delivery_cost_fa: string | null;
  min_buy_toman: string | number | null;
  min_sell_toman: string | number | null;
  pros_fa: string[] | null;
  cons_fa: string[] | null;
  faq: FaqItem[] | null;
}

const SELECT_PROFILES = `
  select slug, payment_methods, kyc_level, mobile_app, delivery_cost_fa,
         min_buy_toman, min_sell_toman, pros_fa, cons_fa, faq
  from platform_profiles
`;

const UPSERT_PROFILE = `
  insert into platform_profiles
    (slug, payment_methods, kyc_level, mobile_app, delivery_cost_fa,
     min_buy_toman, min_sell_toman, pros_fa, cons_fa, faq, updated_at)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
  on conflict (slug) do update
    set payment_methods = excluded.payment_methods,
        kyc_level = excluded.kyc_level,
        mobile_app = excluded.mobile_app,
        delivery_cost_fa = excluded.delivery_cost_fa,
        min_buy_toman = excluded.min_buy_toman,
        min_sell_toman = excluded.min_sell_toman,
        pros_fa = excluded.pros_fa,
        cons_fa = excluded.cons_fa,
        faq = excluded.faq,
        updated_at = now()
`;

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createPgPlatformProfilesSource(): PlatformProfilesSource {
  const pool = pgPool();

  return {
    async readProfiles(): Promise<PlatformProfileEntry[]> {
      const result = await pool.query<ProfileRow>(SELECT_PROFILES);
      return result.rows.map((row) => ({
        slug: row.slug,
        payment_methods: (row.payment_methods ?? []) as PaymentMethod[],
        kyc_level: row.kyc_level as KycLevel | null,
        mobile_app: row.mobile_app as MobileApp | null,
        delivery_cost_fa: row.delivery_cost_fa,
        min_buy_toman: toNumber(row.min_buy_toman),
        min_sell_toman: toNumber(row.min_sell_toman),
        pros_fa: row.pros_fa ?? [],
        cons_fa: row.cons_fa ?? [],
        faq: row.faq ?? [],
      }));
    },

    async writeProfiles(entries: PlatformProfileEntry[]): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const entry of entries) {
          await client.query(UPSERT_PROFILE, [
            entry.slug,
            entry.payment_methods,
            entry.kyc_level,
            entry.mobile_app,
            entry.delivery_cost_fa,
            entry.min_buy_toman,
            entry.min_sell_toman,
            entry.pros_fa,
            entry.cons_fa,
            JSON.stringify(entry.faq),
          ]);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultPlatformProfilesSource(createPgPlatformProfilesSource);
}

export async function loadPlatformProfiles(
  slugs: readonly string[],
): ReturnType<typeof domainLoad> {
  ensureDefaultSource();
  return domainLoad(slugs);
}

export async function savePlatformProfiles(
  entries: readonly PlatformProfileEntry[],
  listedSlugs: ReadonlySet<string>,
): ReturnType<typeof domainSave> {
  ensureDefaultSource();
  return domainSave(entries, listedSlugs);
}
