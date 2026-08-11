-- مهاجرت ۰۱۶ — عکس شاخص پست (بلیت ۲۴).
-- اجرا: psql "$TABLO_DATABASE_URL" -f collector/migrations/016_post_images.sql
--
-- ستون‌های تازه‌ی `posts`: نشانی عمومی عکس (مستقیم از باکت آروان، نه
-- دامنه‌ی خام انبار)، متن جایگزین، و عرض/ارتفاعِ *پس از پردازش* — تا مرورگر
-- جای عکس را پیش از رسیدنش رزرو کند و چیدمان نپرد.
--
-- متن جایگزین اجباری است وقتی عکس هست: دفاع اول در لایه‌ی نوشتنِ وب
-- (`web/src/lib/admin-posts.ts`)، این قید همان قاعده را روی خودِ دیتابیس هم
-- می‌بندد — دفاع دوم، برای وقتی مسیر نوشتن اشتباه کند یا کسی مستقیم بنویسد.
--
-- پستِ بدون عکس دست‌نخورده می‌ماند: هر چهار ستون پیش‌فرض null دارند و قید
-- فقط وقتی image_url پر است فعال می‌شود.
alter table posts
    add column if not exists image_url    text,
    add column if not exists image_alt    text,
    add column if not exists image_width  int,
    add column if not exists image_height int;
alter table posts
    add constraint posts_image_alt_required
    check (image_url is null or (image_alt is not null and image_alt <> ''));
