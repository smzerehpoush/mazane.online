-- Migration 004 — ticket 5: platform market model + price reference table.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/004_references.sql

-- Daric is an order book, not OTC (section 9.2, note 5) — the web layer
-- uses this same column to render the "order book" label. The rest of the
-- platforms are OTC.
alter table platforms
    add column if not exists market_model text not null default 'OTC'
        check (market_model in ('OTC', 'ORDER_BOOK'));

-- Price references (section 12.2: tala.ir, bonbast) — not platforms: a
-- separate table, with no reference to platforms and no entry in the public
-- listing. Every row carries the source's name and URL: a reference number
-- never exists without stating its source (section 7.1). Each row's unit is
-- explicit in instrument (the ounce is priced in USD; quotes are per mithqal).
create table if not exists reference_quotes (
    id             bigserial primary key,
    reference_slug text        not null,
    name_fa        text        not null,
    source_url     text        not null,
    instrument     text        not null check (
        instrument in (
            'GOLD_18K_TOMAN', 'ABSHODE_MITHQAL_TOMAN', 'XAU_USD', 'USD_TOMAN'
        )
    ),
    side           text        not null check (side in ('BUY', 'SELL', 'MID')),
    value          numeric     not null,
    raw_value      numeric     not null,
    raw_scale      numeric     not null,
    fetched_at     timestamptz not null
);

create index if not exists reference_quotes_slug_fetched_at_idx
    on reference_quotes (reference_slug, fetched_at desc);
