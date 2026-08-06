-- مهاجرت ۰۱۰ — جدول پست‌های بلاگ (بلیت ۱۲).
-- اجرا: psql "$MAZANE_DATABASE_URL" -f collector/migrations/010_blog.sql
--
-- بدنه «مارک‌داون» است (تصمیم بلیت ۱۲؛ رندر امن سمت وب در web/lib/markdown.tsx —
-- نه HTML خام). اسلاگ لاتینِ تخت زیر فضای رزروشده‌ی /blog/ (بند ۱۳، تصمیم ۱۱).
--
-- چرخه‌ی وضعیت:
--   draft      ⟸ در صف؛ نه در فهرست، نه صفحه (404)، نه سایت‌مپ
--   published  ⟸ نمایش عمومی؛ صف انتشار (بلیت ۱۳) پس از نوشتن،
--                POST /api/revalidate-blog وب را صدا می‌زند
--   retracted  ⟸ پس‌گیری تک‌فرمانی (بند ۱۳، تصمیم ۱۶): 404 + حذف از فهرست و سایت‌مپ
--
-- updated_at فقط با تغییر معنادار محتوا عوض می‌شود — منبع lastmod سایت‌مپ
-- (بند ۶.۷: هرگز now() نگذارید).

create table if not exists posts (
    slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title_fa     text        not null,
    body_md      text        not null,
    status       text        not null default 'draft'
                 check (status in ('draft', 'published', 'retracted')),
    published_at timestamptz,
    updated_at   timestamptz not null,
    -- هر پستی که از پیش‌نویس گذشته، تاریخ انتشار دارد (پس‌گرفته هم نگهش می‌دارد).
    check (status = 'draft' or published_at is not null)
);

create index if not exists posts_published_idx
    on posts (published_at desc)
    where status = 'published';
