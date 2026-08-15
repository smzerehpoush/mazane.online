-- Migration 014 — blog post view counter.
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/014_post_views.sql
--
-- Why a separate table and not a column on `posts`? Two reasons, both hard:
--
-- 1. **`posts.updated_at` is the source of the sitemap's `lastmod`** (section
--    6.7: never now()). If the counter were a column on that same row, every
--    view would touch the row, and any tool or trigger that updates
--    `updated_at` would tell Google the post's content had changed — exactly
--    what section 6.7 forbids.
-- 2. Their lifecycles differ: `posts` is editorial content and is never
--    pruned (section 7.1), but the counter is a volatile engagement metric.
--    Separating them means the retention policy of one is never imposed on
--    the other.
--
-- Views are counted from the browser, not in server rendering — because the
-- HTML is cached at the ArvanCloud edge and server-side counting would only
-- see cache misses (i.e. a number that says more about cache behavior than
-- about readers). Details in `web/src/lib/views.ts`.
--
-- No personal data is stored: no IP, no user ID, no cookie — just one
-- aggregate number per slug.

create table if not exists post_views (
    slug         text primary key references posts(slug) on delete cascade,
    views        bigint      not null default 0 check (views >= 0),
    last_seen_at timestamptz not null default now()
);

-- The "most-read" query relies on this exact ordering.
create index if not exists post_views_views_idx
    on post_views (views desc);
