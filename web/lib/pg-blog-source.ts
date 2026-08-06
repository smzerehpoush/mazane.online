/**
 * منبع واقعی بلاگ: پستگرس — جدول `posts` که مهاجرت
 * `collector/migrations/010_blog.sql` می‌سازد و خط لوله‌ی محتوا (بلیت ۱۳)
 * پر می‌کند. وب فقط می‌خوانَد.
 *
 * فیلتر وضعیت اینجا نیست — قرارداد BlogSource «هرچه ذخیره است» می‌دهد و
 * قاعده‌ی نمایش در `lib/blog.ts` است (تا مرز تست وب همان را بسنجد).
 * حجم بلاگ کوچک است (چند ده پست)؛ خواندن همه‌ی ردیف‌ها مسئله نیست.
 */
import { Pool } from "pg";

import type { BlogPost, BlogSource, PostStatus } from "./blog";

interface PostRow {
  slug: string;
  title_fa: string;
  body_md: string;
  status: PostStatus;
  published_at: Date | null;
  updated_at: Date;
}

function toPost(row: PostRow): BlogPost {
  return {
    slug: row.slug,
    title_fa: row.title_fa,
    body_md: row.body_md,
    status: row.status,
    published_at: row.published_at === null ? null : row.published_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

const COLUMNS = "slug, title_fa, body_md, status, published_at, updated_at";

export function createPgBlogSource(): BlogSource {
  // همان پیش‌فرض گردآورنده (collector/src/mazane_collector/main.py).
  const pool = new Pool({
    connectionString:
      process.env.MAZANE_DATABASE_URL ??
      "postgresql://mazane:mazane@127.0.0.1:5432/mazane",
    max: 5,
  });

  return {
    async listPosts(): Promise<BlogPost[]> {
      const result = await pool.query<PostRow>(`select ${COLUMNS} from posts`);
      return result.rows.map(toPost);
    },

    async getPost(slug: string): Promise<BlogPost | null> {
      const result = await pool.query<PostRow>(
        `select ${COLUMNS} from posts where slug = $1`,
        [slug],
      );
      const row = result.rows[0];
      return row === undefined ? null : toPost(row);
    },
  };
}
