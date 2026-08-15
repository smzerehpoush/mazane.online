-- Migration 015 — platform settings from the admin panel (ticket 21): chart
-- membership, color, order.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/015_platform_settings.sql
--
-- The owner decides from the panel which platforms appear on the chart at
-- the top of the homepage, in what color, and in what order. The panel only
-- writes to this Postgres table — never directly to Redis (ticket 21 design
-- rule); the collector reads this same table roughly every 20 seconds and
-- syncs it to `tablo:chart_config` (`collector/src/tablo_collector/settings.py`).
--
-- referral_url is being added right now even though it has no code/UI yet —
-- the next ticket (#23) picks it up; adding the column now avoids a second
-- migration. Hard rule 4: this column never appears in the client-side
-- payload of public pages (`web/src/lib/page-data.ts::withoutReferral`).
--
-- Chart membership never affects the order/listing of the price table (hard
-- rule 2) — that table is a function of price alone.
create table if not exists platform_settings (
    slug         text primary key references platforms(slug),
    in_chart     boolean     not null default false,
    chart_color  text        check (chart_color ~ '^#[0-9a-f]{6}$'),
    chart_order  int,
    referral_url text,
    updated_at   timestamptz not null default now()
);
