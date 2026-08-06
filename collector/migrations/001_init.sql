-- مهاجرت ۰۰۱ — جدول‌های تاریخچه‌ی گردآورنده (بند ۲.۲ سند معماری).
-- اجرا: در docker-compose.dev.yml به‌صورت خودکار در اولین بوت پستگرس mount می‌شود؛
-- دستی: psql "$MAZANE_DATABASE_URL" -f collector/migrations/001_init.sql

create table if not exists quotes (
    id            bigserial primary key,
    platform_slug text        not null,
    instrument    text        not null,
    side          text        not null check (side in ('BUY', 'SELL', 'MID')),
    price_toman   numeric     not null,
    raw_value     numeric     not null,
    raw_scale     numeric     not null,
    fetched_at    timestamptz not null
);

create index if not exists quotes_platform_fetched_at_idx
    on quotes (platform_slug, fetched_at desc);

create table if not exists platform_terms (
    id                 bigserial primary key,
    platform_slug      text        not null,
    buy_fee_percent    numeric     not null,
    sell_fee_percent   numeric     not null,
    round_trip_percent numeric     not null,
    fee_source         text        not null check (fee_source in ('API', 'MANUAL')),
    buy_enabled        boolean     not null,
    sell_enabled       boolean     not null,
    observed_at        timestamptz not null
);

create index if not exists platform_terms_platform_observed_at_idx
    on platform_terms (platform_slug, observed_at desc);
