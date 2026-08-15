-- Migration 017 — one price per platform, fee kept separate (decision doc 0002).
--
-- ⚠️⚠️ Step 1 is mandatory and is done **before** running this file. This
-- migration deletes data and is irreversible. `\copy` runs client-side and
-- needs no superuser access:
--
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from quotes where side <> 'MID') to 'archive-0002-quotes.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from hourly_rollups where kind = 'PLATFORM' and side <> 'MID') to 'archive-0002-rollups-platform.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from reference_quotes where reference_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN') to 'archive-0002-references.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from hourly_rollups where kind = 'REFERENCE' and (source_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN')) to 'archive-0002-rollups-reference.csv' csv header"
--
-- Step 2:
--   psql "$TABLO_DATABASE_URL" -f collector/migrations/017_one_price_per_platform.sql
--
-- Why delete, despite section 7.1 and the "archive must never break"
-- guarantee in 011_retention.sql: an owner decision (2026-08-10) following an
-- explicit risk report. For the five two-price platforms, the historical
-- BUY/SELL rows were **the raw number that platform itself published**, not
-- something we computed — meaning this deletion carries away the primary
-- evidence and keeps only the derivative. The step-1 CSV files are the only
-- surviving copy of that evidence.
--
-- From now on, every platform has **exactly one row** per round: side =
-- 'PRICE', the price before any fee. Buy and sell fees stay separate in
-- platform_terms and are never multiplied into the price; `mid × (1 ± f)`
-- has been removed from the code.

begin;

-- ── 1) Delete platforms' derived sides ─────────────────────────────────
delete from quotes where side in ('BUY', 'SELL', 'MEAN');
delete from hourly_rollups where kind = 'PLATFORM' and side in ('BUY', 'SELL', 'MEAN');

-- ── 2) Delete bonbast and unused reference assets ──────────────────────
-- Both were being collected and never displayed anywhere on the site; the
-- only consumer of the reference layer is the "union rate" bar (decision
-- doc 0001), which only reads talair/GOLD_18K_TOMAN.
delete from reference_quotes
    where reference_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN';
delete from hourly_rollups
    where kind = 'REFERENCE'
      and (source_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN');

-- ── 3) Rename the remaining side ────────────────────────────────────────
-- "MID" means the midpoint between ask and bid; for wallgold, melligold, and
-- the rest of the single-price platforms, their number was never the
-- midpoint of anything. Now that it's the only side, its name becomes
-- "PRICE".
-- ⚠️ The old constraint is dropped **before** the update, not after:
-- Postgres checks the constraint on each updated row at that same instant,
-- and `side in (…,'MID',…)` rejects the new value 'PRICE'. If the order were
-- reversed, the whole transaction would roll back with
-- "violates check constraint quotes_side_check".
alter table quotes           drop constraint if exists quotes_side_check;
alter table reference_quotes drop constraint if exists reference_quotes_side_check;
alter table hourly_rollups   drop constraint if exists hourly_rollups_side_check;
alter table reference_quotes drop constraint if exists reference_quotes_instrument_check;

update quotes           set side = 'PRICE' where side = 'MID';
update reference_quotes set side = 'PRICE' where side = 'MID';
update hourly_rollups   set side = 'PRICE' where side = 'MID';

-- ── 4) New constraints: side becomes single-valued ─────────────────────
-- The side column is deliberately not dropped even though it now has only
-- one value: it's part of the natural key
-- unique (kind, source_slug, instrument, side, hour_start) in hourly_rollups,
-- and dropping it would be a pointless migration. The next reader shouldn't
-- think it was left out by mistake.
alter table quotes add constraint quotes_side_check check (side = 'PRICE');

alter table reference_quotes
    add constraint reference_quotes_side_check check (side = 'PRICE');

alter table hourly_rollups
    add constraint hourly_rollups_side_check check (side = 'PRICE');

alter table reference_quotes
    add constraint reference_quotes_instrument_check
        check (instrument = 'GOLD_18K_TOMAN');

-- ── 5) New fee source: IMPLIED ─────────────────────────────────────────
-- A fee the platform never disclosed, which we estimate from half its
-- spread (technogold, tlyn, ecogold, zarafza, baazar). Before this it was
-- filed under the label "from the platform's API" — a claim those
-- platforms never actually made.
--
-- The **historical** platform_terms rows are deliberately not rewritten:
-- they record what claim we had on that particular day, and platform_terms
-- is never pruned per 011_retention.sql. New rows get IMPLIED starting
-- from the next round onward.
alter table platform_terms drop constraint if exists platform_terms_fee_source_check;
alter table platform_terms
    add constraint platform_terms_fee_source_check
        check (fee_source in ('API', 'MANUAL', 'IMPLIED', 'UNKNOWN'));

-- The constraint "a one-sided fee means a bug" stays untouched and covers
-- IMPLIED too: UNKNOWN ⟸ all three null, anything else ⟸ all three
-- populated. Note: zero and null are not the same thing — daric gets 0.0
-- (we know there's no fee), melligold gets null (we don't know).

commit;
