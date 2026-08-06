-- مهاجرت ۰۰۳ — هشت آداپتر REST (بلیت ۴): کارمزد نامعلوم (UNKNOWN).
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/003_unknown_fee_source.sql

-- بعضی سکوها (ملی‌گلد، دیجی‌کالا، همراه‌گلد) کارمزدشان را هیچ‌جا منتشر
-- نکرده‌اند: fee_source = 'UNKNOWN' و هر سه ستون کارمزد NULL — قیمت مؤثر
-- جعل نمی‌شود (فقط سطر MID ذخیره می‌شود).

alter table platform_terms
    alter column buy_fee_percent drop not null,
    alter column sell_fee_percent drop not null,
    alter column round_trip_percent drop not null;

alter table platform_terms
    drop constraint if exists platform_terms_fee_source_check;

alter table platform_terms
    add constraint platform_terms_fee_source_check
        check (fee_source in ('API', 'MANUAL', 'UNKNOWN'));

-- عدد نصفه‌نیمه یعنی باگ: یا هر سه کارمزد هست (API/MANUAL) یا هیچ‌کدام (UNKNOWN).
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
