-- Migration 011 — ticket 16: data retention — hourly rollups forever + raw pruning.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/011_retention.sql
--
-- Section 7.1 (architecture requirement 2): the attributed archive of
-- "what price, when, from which source" is a legal defense and must never
-- break. Policy (section 13, decision 13): raw data for 90 days with
-- consecutive-duplicate compaction + hourly rollups forever.
--
-- One table for both kinds of source: kind = PLATFORM (the quotes table)
-- or REFERENCE (the reference_quotes table) — reference numbers are also
-- displayed and are part of the legal archive. The values for a platform
-- are the displayed price_toman, and for a reference the value itself; only
-- rows with suppressed = false are rolled up (a suppressed row was never
-- displayed and is itself never pruned either — that's documented behavior
-- of the median/sanity check).
--
-- The pruning gate (ticket 16 acceptance criterion) is enforced in code,
-- not here: `retention.prune_expired_raw` only deletes a row if a rollup
-- row exists for that same (kind, source_slug, instrument, side, hour).
-- The platforms, platform_terms, and posts tables are never pruned.

create table if not exists hourly_rollups (
    id           bigserial primary key,
    kind         text        not null check (kind in ('PLATFORM', 'REFERENCE')),
    source_slug  text        not null,
    instrument   text        not null,
    side         text        not null check (side in ('BUY', 'SELL', 'MID')),
    hour_start   timestamptz not null,
    open_value   numeric     not null,
    close_value  numeric     not null,
    min_value    numeric     not null,
    max_value    numeric     not null,
    sample_count integer     not null check (sample_count > 0),
    check (min_value <= max_value),
    -- Natural key: re-running the rollup upserts, never creates a duplicate row.
    unique (kind, source_slug, instrument, side, hour_start)
);

-- History query: a source × instrument time series is read from this same table.
create index if not exists hourly_rollups_source_hour_idx
    on hourly_rollups (source_slug, instrument, hour_start desc);
