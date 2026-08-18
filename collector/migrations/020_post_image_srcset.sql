-- Migration 020 — responsive variants for the post cover image (ticket 78).
-- Run: psql "$TABLO_DATABASE_URL" -f collector/migrations/020_post_image_srcset.sql
--
-- Before this migration one 1600px WebP was uploaded per post and the same
-- file was handed to a phone on a mobile connection. The upload path now
-- also writes narrower copies (160/480/800/1200) next to it, and this column
-- keeps the ready-to-render `srcset` string built from their public URLs.
--
-- The column is nullable and stays null for every image uploaded before this
-- migration: no backfill was run, those narrower objects simply do not exist
-- in the bucket, and the render path must fall back to the single `src`. A
-- srcset without an image makes no sense, so the check mirrors the alt-text
-- rule of migration 016.
alter table posts
    add column if not exists image_srcset text;
alter table posts
    add constraint posts_image_srcset_needs_image
    check (image_srcset is null or image_url is not null);
