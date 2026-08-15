-- Migration 002 — multi-source (ticket 3): median/sanity check suppression flag + platform metadata.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/002_multi_source.sql

-- Cross-platform median/sanity check rejection (contracts rule 3): stays in history, isn't published.
alter table quotes
    add column if not exists suppressed boolean not null default false;

-- Platform metadata — architecture doc section 2.2. is_listed is a function
-- of data_policy alone (section 13, decision 20); goldika is
-- PERMISSION_PENDING: crawled and stored, never displayed.
create table if not exists platforms (
    slug        text primary key,
    name_fa     text not null,
    data_policy text not null check (
        data_policy in ('ALLOWED', 'RESTRICTED', 'PERMISSION_PENDING', 'BLOCKED')
    ),
    is_listed   boolean not null
);
