-- Migration 016 — post cover image (ticket 24).
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/016_post_images.sql
--
-- New `posts` columns: the image's public URL (straight from the ArvanCloud
-- bucket, not the raw storage domain), alt text, and width/height *after
-- processing* — so the browser can reserve the image's space before it
-- arrives and the layout doesn't jump.
--
-- Alt text is required whenever there is an image: the first line of
-- defense is in the web write layer (`web/src/lib/admin-posts.ts`); this
-- constraint locks the same rule onto the database itself too — a second
-- line of defense, for when the write path gets it wrong or someone writes
-- directly.
--
-- A post with no image stays untouched: all four columns default to null,
-- and the constraint only activates when image_url is populated.
alter table posts
    add column if not exists image_url    text,
    add column if not exists image_alt    text,
    add column if not exists image_width  int,
    add column if not exists image_height int;
alter table posts
    add constraint posts_image_alt_required
    check (image_url is null or (image_alt is not null and image_alt <> ''));
