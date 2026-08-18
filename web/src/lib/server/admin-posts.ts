/**
 * ⚠️ The Python content automation pipeline
 * (`collector/src/tablo_collector/content/`) reads/writes this same table —
 * this file sits fully alongside it, not in place of it.
 */
import "@tanstack/react-start/server-only";

import {
  createPost as domainCreate,
  getAdminPost as domainGetPost,
  listAllPosts as domainList,
  publishPost as domainPublish,
  retractPost as domainRetract,
  setDefaultAdminPostsSource,
  setPostImage as domainSetImage,
  updatePost as domainUpdate,
  type AdminPostsSource,
  type CreatePostInput,
  type PostImagePatch,
  type UpdatePostInput,
  type WriteResult,
} from "../admin-posts";
import type { BlogPost, PostStatus } from "../blog";
import { pgPool } from "./blog-source";

interface PostRow {
  slug: string;
  title_fa: string;
  body_md: string;
  status: PostStatus;
  published_at: Date | null;
  updated_at: Date;
  image_url: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  image_srcset: string | null;
}

function toPost(row: PostRow): BlogPost {
  return {
    slug: row.slug,
    title_fa: row.title_fa,
    body_md: row.body_md,
    status: row.status,
    published_at: row.published_at === null ? null : row.published_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    image_url: row.image_url,
    image_alt: row.image_alt,
    image_width: row.image_width,
    image_height: row.image_height,
    image_srcset: row.image_srcset,
  };
}

const COLUMNS =
  "slug, title_fa, body_md, status, published_at, updated_at, " +
  "image_url, image_alt, image_width, image_height, image_srcset";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export function createPgAdminPostsSource(): AdminPostsSource {
  const pool = pgPool();

  return {
    async listPosts(): Promise<BlogPost[]> {
      const result = await pool.query<PostRow>(
        `select ${COLUMNS} from posts order by updated_at desc`,
      );
      return result.rows.map(toPost);
    },

    async getPost(slug: string): Promise<BlogPost | null> {
      const result = await pool.query<PostRow>(`select ${COLUMNS} from posts where slug = $1`, [
        slug,
      ]);
      const row = result.rows[0];
      return row === undefined ? null : toPost(row);
    },

    async insertPost(post: BlogPost): Promise<void> {
      await pool.query(
        `insert into posts (slug, title_fa, body_md, status, published_at, updated_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [post.slug, post.title_fa, post.body_md, post.status, post.published_at, post.updated_at],
      );
    },

    async updatePost(
      slug: string,
      patch: { title_fa: string; body_md: string; updated_at: string },
    ): Promise<void> {
      await pool.query(
        `update posts set title_fa = $2, body_md = $3, updated_at = $4 where slug = $1`,
        [slug, patch.title_fa, patch.body_md, patch.updated_at],
      );
    },

    async setStatus(
      slug: string,
      patch: { status: PostStatus; published_at: string | null; updated_at: string },
    ): Promise<void> {
      await pool.query(
        `update posts set status = $2, published_at = $3, updated_at = $4 where slug = $1`,
        [slug, patch.status, patch.published_at, patch.updated_at],
      );
    },

    async setImage(slug: string, patch: PostImagePatch): Promise<void> {
      await pool.query(
        `update posts set image_url = $2, image_alt = $3, image_width = $4, image_height = $5,
                image_srcset = $6
         where slug = $1`,
        [
          slug,
          patch.image_url,
          patch.image_alt,
          patch.image_width,
          patch.image_height,
          patch.image_srcset ?? null,
        ],
      );
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultAdminPostsSource(createPgAdminPostsSource);
}

export async function listAllPosts(): Promise<BlogPost[]> {
  ensureDefaultSource();
  return domainList();
}

export async function getAdminPost(slug: string): Promise<BlogPost | null> {
  ensureDefaultSource();
  return domainGetPost(slug);
}

export async function createPost(input: CreatePostInput, now: string): Promise<WriteResult> {
  ensureDefaultSource();
  try {
    return await domainCreate(input, now);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, kind: "invalid", error: "این اسلاگ قبلاً استفاده شده است" };
    }
    throw error;
  }
}

export async function updatePost(
  slug: string,
  input: UpdatePostInput,
  now: string,
): Promise<WriteResult> {
  ensureDefaultSource();
  return domainUpdate(slug, input, now);
}

export async function publishPost(slug: string, now: string): Promise<WriteResult> {
  ensureDefaultSource();
  return domainPublish(slug, now);
}

export async function retractPost(slug: string): Promise<WriteResult> {
  ensureDefaultSource();
  return domainRetract(slug);
}

export async function setPostImage(slug: string, image: PostImagePatch): Promise<WriteResult> {
  ensureDefaultSource();
  return domainSetImage(slug, image);
}
