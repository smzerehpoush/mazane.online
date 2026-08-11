-- مهاجرت ۰۱۷ — یک قیمت به‌ازای هر سکو، کارمزد جدا (سند تصمیم ۰۰۰۲).
--
-- ⚠️⚠️ گام ۱ اجباری است و **پیش از** اجرای این فایل انجام می‌شود. این
-- مهاجرت داده حذف می‌کند و برگشت‌ناپذیر است. `\copy` سمت کلاینت است و
-- دسترسی superuser نمی‌خواهد:
--
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from quotes where side <> 'MID') to 'archive-0002-quotes.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from hourly_rollups where kind = 'PLATFORM' and side <> 'MID') to 'archive-0002-rollups-platform.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from reference_quotes where reference_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN') to 'archive-0002-references.csv' csv header"
--   psql "$TABLO_DATABASE_URL" -c "\copy (select * from hourly_rollups where kind = 'REFERENCE' and (source_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN')) to 'archive-0002-rollups-reference.csv' csv header"
--
-- گام ۲:
--   psql "$TABLO_DATABASE_URL" -f collector/migrations/017_one_price_per_platform.sql
--
-- چرا حذف، با وجود بند ۷.۱ و تضمین «آرشیو هرگز نباید بشکند» در
-- 011_retention.sql: تصمیم مالک (۲۰۲۶-۰۸-۱۰) پس از گزارش صریح ریسک. برای
-- پنج سکوی دوقیمتی، سطرهای تاریخی BUY/SELL **عدد خامِ منتشرشده‌ی خود آن
-- سکو** بودند، نه محاسبه‌ی ما — یعنی این حذف مدرک اولیه می‌برد و مشتق را
-- نگه می‌دارد. فایل‌های CSV گام ۱ تنها نسخه‌ی باقی‌مانده‌ی آن مدرک‌اند.
--
-- از این پس هر سکو در هر نوبت **دقیقاً یک سطر** دارد: side = 'PRICE'،
-- قیمت پیش از هر کارمزد. کارمزد خرید و فروش جدا در platform_terms می‌مانند
-- و هرگز در قیمت ضرب نمی‌شوند؛ `mid × (1 ± f)` از کد حذف شده است.

begin;

-- ── ۱) حذف سمت‌های مشتق سکوها ──────────────────────────────────────────
delete from quotes where side in ('BUY', 'SELL', 'MEAN');
delete from hourly_rollups where kind = 'PLATFORM' and side in ('BUY', 'SELL', 'MEAN');

-- ── ۲) حذف بن‌بست و دارایی‌های مرجعِ بی‌مصرف ───────────────────────────
-- هر دو جمع‌آوری می‌شدند و هیچ‌جای سایت نمایش داده نمی‌شدند؛ تنها مصرف
-- لایه‌ی مرجع نوار «نرخ اتحادیه» است (سند تصمیم ۰۰۰۱) که فقط
-- talair/GOLD_18K_TOMAN را می‌خواند.
delete from reference_quotes
    where reference_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN';
delete from hourly_rollups
    where kind = 'REFERENCE'
      and (source_slug = 'bonbast' or instrument <> 'GOLD_18K_TOMAN');

-- ── ۳) تغییر نام سمتِ باقی‌مانده ───────────────────────────────────────
-- «MID» یعنی وسطِ ask و bid؛ برای وال‌گلد و ملی‌گلد و بقیه‌ی تک‌قیمتی‌ها
-- عددشان وسطِ هیچ‌چیز نبود. حالا که تنها سمت است، نامش «PRICE» می‌شود.
update quotes           set side = 'PRICE' where side = 'MID';
update reference_quotes set side = 'PRICE' where side = 'MID';
update hourly_rollups   set side = 'PRICE' where side = 'MID';

-- ── ۴) قیدها: تک‌مقداری‌شدن side ───────────────────────────────────────
-- ستون side عمداً حذف نمی‌شود گرچه یک مقدار بیشتر ندارد: جزو کلید طبیعی
-- unique (kind, source_slug, instrument, side, hour_start) در hourly_rollups
-- است و حذفش مهاجرتی بی‌دلیل بود. خواننده‌ی بعدی نباید فکر کند جا افتاده.
alter table quotes drop constraint if exists quotes_side_check;
alter table quotes add constraint quotes_side_check check (side = 'PRICE');

alter table reference_quotes drop constraint if exists reference_quotes_side_check;
alter table reference_quotes
    add constraint reference_quotes_side_check check (side = 'PRICE');

alter table hourly_rollups drop constraint if exists hourly_rollups_side_check;
alter table hourly_rollups
    add constraint hourly_rollups_side_check check (side = 'PRICE');

alter table reference_quotes drop constraint if exists reference_quotes_instrument_check;
alter table reference_quotes
    add constraint reference_quotes_instrument_check
        check (instrument = 'GOLD_18K_TOMAN');

-- ── ۵) منشأ تازه‌ی کارمزد: IMPLIED ────────────────────────────────────
-- کارمزدی که سکو اعلامش نکرده و ما از نصفِ اسپردش برآورد کرده‌ایم
-- (تکنوگلد، طلاین، اکوگلد، زرافزا، بازر). پیش از این زیر برچسب «از API
-- سکو» می‌رفت — ادعایی که آن سکوها هرگز نکرده‌اند.
--
-- سطرهای **تاریخی** platform_terms عمداً بازنویسی نمی‌شوند: آن‌ها ثبت
-- می‌کنند که ما آن روز چه ادعایی داشتیم، و platform_terms طبق
-- 011_retention.sql هرگز هرس نمی‌شود. سطرهای تازه از نوبت بعدی IMPLIED
-- می‌گیرند.
alter table platform_terms drop constraint if exists platform_terms_fee_source_check;
alter table platform_terms
    add constraint platform_terms_fee_source_check
        check (fee_source in ('API', 'MANUAL', 'IMPLIED', 'UNKNOWN'));

-- قید «عدد نصفه‌نیمه یعنی باگ» دست‌نخورده می‌ماند و IMPLIED را هم پوشش
-- می‌دهد: UNKNOWN ⟸ هر سه تهی، هر چیز دیگر ⟸ هر سه پر. توجه: صفر با تهی
-- یکی نیست — داریک ۰٫۰ می‌گیرد (می‌دانیم کارمزدی نیست)، ملی‌گلد تهی
-- (نمی‌دانیم).

commit;
