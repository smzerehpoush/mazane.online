begin;

alter table reference_quotes drop constraint if exists reference_quotes_instrument_check;

alter table reference_quotes
    add constraint reference_quotes_instrument_check
        check (instrument in ('GOLD_18K_TOMAN', 'XAU', 'USD_TOMAN'));

commit;
