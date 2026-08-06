-- مهاجرت ۰۱۵ — تنظیمات سکو از پنل مدیریت (بلیت ۲۱): عضویت نمودار، رنگ، ترتیب.
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/015_platform_settings.sql
--
-- مالک از پنل تعیین می‌کند کدام سکوها بالای صفحه‌ی اصلی روی نمودار باشند،
-- با چه رنگ و ترتیبی. پنل فقط همین جدول پستگرس را می‌نویسد — هرگز مستقیم
-- به ردیس (بند طراحی تیکت ۲۱)؛ گردآورنده هر ~۲۰ ثانیه همین جدول را می‌خواند
-- و به `mazane:chart_config` همگام می‌کند (`collector/src/mazane_collector/settings.py`).
--
-- referral_url همین حالا اضافه می‌شود ولی هنوز هیچ کد/UI ای ندارد — تیکت
-- بعدی (#23) پرش می‌کند؛ اضافه‌کردن ستون الان از یک مهاجرت دوم جلوگیری
-- می‌کند. قاعده‌ی سخت ۴: این ستون هرگز در payload سمت کلاینت صفحات عمومی
-- نمی‌آید (`web/src/lib/page-data.ts::withoutReferral`).
--
-- عضویت نمودار هرگز روی ترتیب/فهرست‌شدنِ جدول قیمت اثر نمی‌گذارد (قاعده‌ی
-- سخت ۲) — آن جدول فقط تابع قیمت مؤثر است.
create table if not exists platform_settings (
    slug         text primary key references platforms(slug),
    in_chart     boolean     not null default false,
    chart_color  text        check (chart_color ~ '^#[0-9a-f]{6}$'),
    chart_order  int,
    referral_url text,
    updated_at   timestamptz not null default now()
);
