-- Migration 003 — eight REST adapters (ticket 4): unknown fee (UNKNOWN).
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/003_unknown_fee_source.sql

-- Some platforms (melligold, digikala, hamrahgold) have never published
-- their fee anywhere: fee_source = 'UNKNOWN' and all three fee columns are
-- NULL — the price is not fabricated (only the MID row is stored).

alter table platform_terms
    alter column buy_fee_percent drop not null,
    alter column sell_fee_percent drop not null,
    alter column round_trip_percent drop not null;

alter table platform_terms
    drop constraint if exists platform_terms_fee_source_check;

alter table platform_terms
    add constraint platform_terms_fee_source_check
        check (fee_source in ('API', 'MANUAL', 'UNKNOWN'));

-- A half-populated number means a bug: either all three fees are present (API/MANUAL) or none are (UNKNOWN).
alter table platform_terms
    drop constraint if exists platform_terms_unknown_fees_null_check;

alter table platform_terms
    add constraint platform_terms_unknown_fees_null_check
        check (
            (fee_source = 'UNKNOWN'
                and buy_fee_percent is null
                and sell_fee_percent is null
                and round_trip_percent is null)
            or (fee_source <> 'UNKNOWN'
                and buy_fee_percent is not null
                and sell_fee_percent is not null
                and round_trip_percent is not null)
        );
