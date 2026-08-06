-- مهاجرت ۰۱۴ — شمارنده‌ی بازدید پست‌های بلاگ.
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/014_post_views.sql
--
-- چرا جدول جدا و نه یک ستون روی `posts`؟ دو دلیل، هر دو سخت:
--
-- ۱. **`posts.updated_at` منبع `lastmod` سایت‌مپ است** (بند ۶.۷: هرگز now()).
--    اگر شمارنده ستونی روی همان ردیف بود، هر بازدید ردیف را لمس می‌کرد و
--    هر ابزار یا تریگری که `updated_at` را به‌روز می‌کند، به گوگل می‌گفت
--    محتوای پست عوض شده — دقیقاً همان چیزی که بند ۶.۷ منع می‌کند.
-- ۲. چرخه‌ی عمرشان فرق دارد: `posts` محتوای تحریریه است و هرگز هرس نمی‌شود
--    (بند ۷.۱)، ولی شمارنده یک سنجه‌ی تعاملی جهش‌پذیر است. جداکردنشان یعنی
--    سیاست نگه‌داری یکی به دیگری تحمیل نمی‌شود.
--
-- بازدید از مرورگر شمرده می‌شود، نه در رندر سرور — چون HTML در لبه‌ی آروان
-- کش می‌شود و شمارش سمت سرور فقط cache-miss ها را می‌دید (یعنی عددی که
-- بیشتر درباره‌ی رفتار کش است تا خواننده). جزئیات در `web/src/lib/views.ts`.
--
-- هیچ داده‌ی شخصی ذخیره نمی‌شود: نه IP، نه شناسه‌ی کاربر، نه کوکی — فقط یک
-- عدد تجمیعی برای هر اسلاگ.

create table if not exists post_views (
    slug         text primary key references posts(slug) on delete cascade,
    views        bigint      not null default 0 check (views >= 0),
    last_seen_at timestamptz not null default now()
);

-- کوئری «پرخواننده‌ترین‌ها» روی همین ترتیب می‌نشیند.
create index if not exists post_views_views_idx
    on post_views (views desc);
