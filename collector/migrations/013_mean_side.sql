-- مهاجرت ۰۱۳ — سمت تازه‌ی 'MEAN': «قیمت مرجع سکو» سطر ماندگار می‌شود.
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/013_mean_side.sql
-- (شماره‌ی ۰۱۲ پیش‌تر با 012_evergreen_posts.sql گرفته شده بود.)
--
-- چرا: تا امروز قیمت مرجع هر سکو فقط یک computed_field در JSON کانونی بود
-- (`reference_prices_toman`) و در پستگرس **ذخیره نمی‌شد** ⟸ نه تاریخچه
-- داشت نه در تجمیع ساعتی می‌آمد. نمودار ۲۴ ساعته‌ی صفحه‌ی اصلی دقیقاً همین
-- سری تاریخی را می‌خواهد (هر خط = قیمت مرجع یک سکو)، پس MEAN سطر واقعی
-- جدول `quotes` می‌شود و از همان‌جا خودبه‌خود به `hourly_rollups` می‌رسد.
--
-- MEAN = قیمت مرجع **خودِ همان سکو** (تصمیم صاحب کسب‌وکار ۲۰۲۶-۰۸-۰۶):
-- سکوی دوقیمتی ⟸ میانگین دو عدد خودش؛ سکوی تک‌قیمتی ⟸ همان تک‌عدد؛
-- دفتر سفارش یک‌طرفه ⟸ اصلاً سطر MEAN ندارد (جعل ممنوع).
-- **هرگز میانگین بین‌سکویی نیست** (قاعده‌ی ۴ قراردادها، خط قرمز حقوقی بند
-- ۷.۱): هر سطر `platform_slug` خودش را دارد و فقط از سطرهای همان سکو ساخته
-- می‌شود. سطرها را خودِ مدل `PlatformSnapshot` می‌سازد، نه آداپترها — پس
-- JSON کانونی و این جدول نمی‌توانند واگرا شوند.
--
-- جدول `reference_quotes` عمداً دست‌نخورده می‌ماند: آن مالِ **مرجع قیمت**
-- (tala.ir، بن‌بست) است — منبع بیرونیِ اعتبارسنجی که سکو نیست و MEAN ندارد.
--
-- مهاجرت فقط قید را باز می‌کند؛ هیچ ردیف تاریخی‌ای بازنویسی نمی‌شود:
-- سطرهای MEAN از نوبت‌های بعدی گردآوری به بعد انباشته می‌شوند.

alter table quotes
    drop constraint if exists quotes_side_check;

alter table quotes
    add constraint quotes_side_check
        check (side in ('BUY', 'SELL', 'MID', 'MEAN'));

alter table hourly_rollups
    drop constraint if exists hourly_rollups_side_check;

alter table hourly_rollups
    add constraint hourly_rollups_side_check
        check (side in ('BUY', 'SELL', 'MID', 'MEAN'));
