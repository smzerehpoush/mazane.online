import "@tanstack/react-start/server-only";

import { Pool } from "pg";

import {
  getPublishedPost as readPublishedPost,
  listPublishedPosts as readPublishedPosts,
  listPublishedPostsStrict as readPublishedPostsStrict,
  setDefaultBlogSource,
  type BlogPost,
  type BlogSource,
  type PostStatus,
  type PublishedPost,
} from "../blog";

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

export function createPgBlogSource(): BlogSource {
  const pool = pgPool();

  return {
    async listPosts(): Promise<BlogPost[]> {
      const result = await pool.query<PostRow>(`select ${COLUMNS} from posts`);
      return result.rows.map(toPost);
    },

    async getPost(slug: string): Promise<BlogPost | null> {
      const result = await pool.query<PostRow>(`select ${COLUMNS} from posts where slug = $1`, [
        slug,
      ]);
      const row = result.rows[0];
      return row === undefined ? null : toPost(row);
    },
  };
}

let sharedPool: Pool | null = null;

export function pgPool(): Pool {
  if (sharedPool === null) {
    sharedPool = new Pool({
      connectionString:
        process.env["TABLO_DATABASE_URL"] ?? "postgresql://mazane:mazane@127.0.0.1:5432/mazane",
      max: 5,
    });
  }
  return sharedPool;
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultBlogSource(createPgBlogSource);
}

export async function listPublishedPosts(): Promise<PublishedPost[]> {
  ensureDefaultSource();
  return readPublishedPosts();
}

export async function getPublishedPost(slug: string): Promise<PublishedPost | null> {
  ensureDefaultSource();
  return readPublishedPost(slug);
}

export async function listPublishedPostsStrict(): Promise<PublishedPost[]> {
  ensureDefaultSource();
  return readPublishedPostsStrict();
}
