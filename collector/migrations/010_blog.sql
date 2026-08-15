-- Migration 010 — blog posts table (ticket 12).
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/010_blog.sql
--
-- The body is "markdown" (ticket 12 decision; safe rendering happens on the
-- web side in web/lib/markdown.tsx — not raw HTML). Flat Latin slug under
-- the reserved /blog/ namespace (section 13, decision 11).
--
-- Status lifecycle:
--   draft      <- queued; not in the listing, no page (404), not in the sitemap
--   published  <- publicly visible; the publish queue (ticket 13) calls
--                POST /api/revalidate-blog on the web after writing
--   retracted  <- one-command retraction (section 13, decision 16): 404 + removed from the listing and sitemap
--
-- updated_at only changes on a meaningful content change — it's the
-- sitemap's lastmod source (section 6.7: never set it to now()).

create table if not exists posts (
    slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title_fa     text        not null,
    body_md      text        not null,
    status       text        not null default 'draft'
                 check (status in ('draft', 'published', 'retracted')),
    published_at timestamptz,
    updated_at   timestamptz not null,
    -- Every post that has moved past draft has a publish date (retracted posts keep it too).
    check (status = 'draft' or published_at is not null)
);

create index if not exists posts_published_idx
    on posts (published_at desc)
    where status = 'published';
