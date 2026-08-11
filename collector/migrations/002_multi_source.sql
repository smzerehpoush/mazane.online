-- مهاجرت ۰۰۲ — چندمنبعی (بلیت ۳): پرچم سرکوب چک میانه + فراداده‌ی سکوها.
-- اجرا: psql "$TABLO_DATABASE_URL" -f collector/migrations/002_multi_source.sql

-- رد چک میانه‌ی تقاطعی (قاعده‌ی ۳ قراردادها): در تاریخچه می‌ماند، منتشر نمی‌شود.
alter table quotes
    add column if not exists suppressed boolean not null default false;

-- فراداده‌ی سکوها — بند ۲.۲ سند معماری. is_listed فقط تابع data_policy است
-- (بند ۱۳، تصمیم ۲۰)؛ گلدیکا PERMISSION_PENDING است: کرال و ذخیره، بدون نمایش.
create table if not exists platforms (
    slug        text primary key,
    name_fa     text not null,
    data_policy text not null check (
        data_policy in ('ALLOWED', 'RESTRICTED', 'PERMISSION_PENDING', 'BLOCKED')
    ),
    is_listed   boolean not null
);
