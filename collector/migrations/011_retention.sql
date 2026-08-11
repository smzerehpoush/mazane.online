-- مهاجرت ۰۱۱ — بلیت ۱۶: نگه‌داری داده — تجمیع ساعتی برای همیشه + هرس خام.
-- اجرا: psql "$TABLO_DATABASE_URL" -f collector/migrations/011_retention.sql
--
-- بند ۷.۱ (الزام معماری ۲): آرشیو منتسبِ «چه قیمتی، کی، از کدام منبع» دفاع
-- حقوقی است و هرگز نباید بشکند. سیاست (بند ۱۳، تصمیم ۱۳): خام ۹۰ روز با
-- فشرده‌سازی تکراری‌های متوالی + تجمیع ساعتی برای همیشه.
--
-- یک جدول برای هر دو نوع منبع: kind = PLATFORM (جدول quotes) یا REFERENCE
-- (جدول reference_quotes) — عدد مرجع هم نمایش داده می‌شود و جزو آرشیو حقوقی
-- است. value ها برای سکو همان price_toman نمایش‌داده‌شده‌اند و برای مرجع
-- همان value؛ فقط ردیف‌های suppressed = false تجمیع می‌شوند (سرکوب‌شده هرگز
-- نمایش داده نشده و خودش هم هرگز هرس نمی‌شود — سند کارکرد چک میانه است).
--
-- دروازه‌ی هرس (معیار پذیرش بلیت ۱۶) در کد اعمال می‌شود، نه اینجا:
-- `retention.prune_expired_raw` فقط ردیفی را حذف می‌کند که برای همان
-- (kind, source_slug, instrument, side, ساعت) ردیف تجمیع موجود باشد.
-- جدول‌های platforms، platform_terms و posts هرگز هرس نمی‌شوند.

create table if not exists hourly_rollups (
    id           bigserial primary key,
    kind         text        not null check (kind in ('PLATFORM', 'REFERENCE')),
    source_slug  text        not null,
    instrument   text        not null,
    side         text        not null check (side in ('BUY', 'SELL', 'MID')),
    hour_start   timestamptz not null,
    open_value   numeric     not null,
    close_value  numeric     not null,
    min_value    numeric     not null,
    max_value    numeric     not null,
    sample_count integer     not null check (sample_count > 0),
    check (min_value <= max_value),
    -- کلید طبیعی: بازاجرای تجمیع upsert می‌کند، هرگز ردیف تکراری نمی‌سازد.
    unique (kind, source_slug, instrument, side, hour_start)
);

-- کوئری تاریخچه: سری زمانی یک منبع×دارایی از همین جدول خوانده می‌شود.
create index if not exists hourly_rollups_source_hour_idx
    on hourly_rollups (source_slug, instrument, hour_start desc);
