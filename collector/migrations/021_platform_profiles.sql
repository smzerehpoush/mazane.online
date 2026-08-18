-- Migration 021 — the platform comparison profile (ticket 75): payment
-- methods, KYC, mobile app, delivery cost, minimum buy/sell, pros/cons and a
-- per-platform FAQ.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/021_platform_profiles.sql
--
-- These columns are created empty on purpose. The values are human work that
-- rides along with the 9-platform fee project (#46); until a row exists the
-- platform page renders nothing for them, never a placeholder.
--
-- Why a table and not registry code (`platforms.py`): every column here is a
-- commercial term the platform itself can change tomorrow without telling us.
-- The owner has to be able to correct it from the admin panel in a minute,
-- not through a deploy. The one genuinely immutable new fact, the founding
-- year, went into the registry instead and is deliberately absent here.
--
-- The write path is the admin panel (Postgres only, never Redis); the
-- collector reads this table in the same ~20 second settings sync as
-- `platform_settings` and merges it onto the live registry, so it reaches
-- `tablo:listed` and from there the web layer.
--
-- Licenses and permits are deliberately not modelled here (issue #26,
-- decision 20): publishing a wrong license claim about a financial platform
-- is a real liability, and that call needs a legal opinion, not a column.

begin;

create table if not exists platform_profiles (
    slug             text primary key references platforms(slug),
    payment_methods  text[]      not null default '{}',
    kyc_level        text,
    mobile_app       text,
    delivery_cost_fa text,
    min_buy_toman    bigint,
    min_sell_toman   bigint,
    pros_fa          text[]      not null default '{}',
    cons_fa          text[]      not null default '{}',
    faq              jsonb       not null default '[]'::jsonb,
    updated_at       timestamptz not null default now()
);

alter table platform_profiles
    drop constraint if exists platform_profiles_kyc_level_check;

alter table platform_profiles
    add constraint platform_profiles_kyc_level_check
        check (kyc_level is null or kyc_level in ('NONE', 'BASIC', 'FULL'));

alter table platform_profiles
    drop constraint if exists platform_profiles_mobile_app_check;

alter table platform_profiles
    add constraint platform_profiles_mobile_app_check
        check (mobile_app is null or mobile_app in ('WEB_ONLY', 'ANDROID', 'IOS', 'BOTH'));

alter table platform_profiles
    drop constraint if exists platform_profiles_payment_methods_check;

alter table platform_profiles
    add constraint platform_profiles_payment_methods_check
        check (
            payment_methods <@ array[
                'GATEWAY', 'CARD_TO_CARD', 'DIRECT_DEBIT', 'WALLET', 'IBAN_TRANSFER'
            ]::text[]
        );

-- A minimum of zero is not a minimum; it is an unfilled form saved by accident.
alter table platform_profiles
    drop constraint if exists platform_profiles_minimums_positive_check;

alter table platform_profiles
    add constraint platform_profiles_minimums_positive_check
        check (
            (min_buy_toman is null or min_buy_toman > 0)
            and (min_sell_toman is null or min_sell_toman > 0)
        );

alter table platform_profiles
    drop constraint if exists platform_profiles_faq_is_array_check;

alter table platform_profiles
    add constraint platform_profiles_faq_is_array_check
        check (jsonb_typeof(faq) = 'array');

commit;
