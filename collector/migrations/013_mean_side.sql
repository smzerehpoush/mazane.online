-- Migration 013 — new side 'MEAN': the platform's reference price becomes a
-- persistent row.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/013_mean_side.sql
-- (Number 012 was already taken by 012_evergreen_posts.sql.)
--
-- Why: until today, each platform's reference price was only a
-- computed_field in the canonical JSON (`reference_prices_toman`) and was
-- **not stored** in Postgres ⟸ it had neither history nor a place in the
-- hourly rollup. The homepage's 24-hour chart wants exactly this historical
-- series (each line = one platform's reference price), so MEAN becomes a
-- real row in the `quotes` table and from there automatically reaches
-- `hourly_rollups`.
--
-- MEAN = the reference price of **that same platform itself** (business
-- owner decision, 2026-08-06): a two-price platform ⟸ the average of its
-- own two numbers; a single-price platform ⟸ that same single number; a
-- one-sided order book ⟸ has no MEAN row at all (fabrication forbidden).
-- **It is never an average across platforms** (contracts rule 4, legal red
-- line section 7.1): each row has its own `platform_slug` and is built only
-- from that same platform's own rows. The rows are built by the
-- `PlatformSnapshot` model itself, not by the adapters — so the canonical
-- JSON and this table can never diverge.
--
-- The `reference_quotes` table deliberately stays untouched: that belongs to
-- the **price reference** (tala.ir, bonbast) — an external validation
-- source that is not a platform and has no MEAN.
--
-- The migration only lifts the constraint; no historical row is rewritten:
-- MEAN rows accumulate starting from the next collection rounds onward.

alter table quotes
    drop constraint if exists quotes_side_check;

alter table quotes
    add constraint quotes_side_check
        check (side in ('BUY', 'SELL', 'MID', 'MEAN'));

alter table hourly_rollups
    drop constraint if exists hourly_rollups_side_check;

alter table hourly_rollups
    add constraint hourly_rollups_side_check
        check (side in ('BUY', 'SELL', 'MID', 'MEAN'));
