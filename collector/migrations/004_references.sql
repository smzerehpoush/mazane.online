-- مهاجرت ۰۰۴ — بلیت ۵: مدل معاملاتی سکو + جدول مراجع قیمت.
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/004_references.sql

-- داریک دفتر سفارش است نه OTC (بند ۹.۲ نکته‌ی ۵) — لایه‌ی وب از همین
-- ستون برچسب «دفتر سفارش» می‌زند. بقیه‌ی سکوها OTC اند.
alter table platforms
    add column if not exists market_model text not null default 'OTC'
        check (market_model in ('OTC', 'ORDER_BOOK'));

-- مراجع قیمت (بند ۱۲.۲: طلا دات‌آی‌آر، بن‌بست) — سکو نیستند: جدول جدا،
-- بدون هیچ ارجاعی به platforms و بدون ورود به فهرست عمومی. هر ردیف نام و
-- نشانی منبع را حمل می‌کند: عدد مرجع بدون ذکر منبع وجود ندارد (بند ۷.۱).
-- واحد هر ردیف در instrument صریح است (انس دلاری است، مظنه بر مثقال).
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
