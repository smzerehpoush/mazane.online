/**
 * `lib/admin-posts.ts` — منطق خالص ساخت/ویرایش/انتشار/پس‌گیری پست پنل
 * (بلیت ۲۲)، با منبع فیک درون‌حافظه‌ای، بی‌نیاز از پستگرس.
 *
 * سنجیده می‌شود:
 *   ۱. `nextUpdatedAt` — تابع خالصِ قاعده‌ی بند ۵ قراردادها.
 *   ۲. `createPost` — اسلاگ بدشکل/تکراری رد می‌شود؛ موفق ⟸ `draft`.
 *   ۳. `updatePost` — پیش‌نویس هرگز `updated_at` را جلو نمی‌برد (حتی با
 *      `meaningfulEdit=true` از کلاینت)؛ منتشرشده فقط با تیک صریح جلو می‌رود.
 *   ۴. `publishPost`/`retractPost` — گذار وضعیت درست، `updated_at` طبق قاعده.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  createPost,
  getAdminPost,
  isValidSlug,
  listAllPosts,
  nextUpdatedAt,
  publishPost,
  resetAdminPostsSource,
  retractPost,
  setAdminPostsSource,
  updatePost,
  type AdminPostsSource,
} from "../src/lib/admin-posts";
import type { BlogPost, PostStatus } from "../src/lib/blog";

class FakeAdminPostsSource implements AdminPostsSource {
  posts = new Map<string, BlogPost>();
  inserted: BlogPost[] = [];
  updated: { slug: string; title_fa: string; body_md: string; updated_at: string }[] = [];
  statusChanges: {
    slug: string;
    status: PostStatus;
    published_at: string | null;
    updated_at: string;
  }[] = [];

  seed(post: BlogPost): void {
    this.posts.set(post.slug, post);
  }

  async listPosts(): Promise<BlogPost[]> {
    return [...this.posts.values()];
  }

  async getPost(slug: string): Promise<BlogPost | null> {
    return this.posts.get(slug) ?? null;
  }

  async insertPost(post: BlogPost): Promise<void> {
    this.inserted.push(post);
    this.posts.set(post.slug, post);
  }

  async updatePost(
    slug: string,
    patch: { title_fa: string; body_md: string; updated_at: string },
  ): Promise<void> {
    this.updated.push({ slug, ...patch });
    const existing = this.posts.get(slug);
    if (existing !== undefined) this.posts.set(slug, { ...existing, ...patch });
  }

  async setStatus(
    slug: string,
    patch: { status: PostStatus; published_at: string | null; updated_at: string },
  ): Promise<void> {
    this.statusChanges.push({ slug, ...patch });
    const existing = this.posts.get(slug);
    if (existing !== undefined) this.posts.set(slug, { ...existing, ...patch });
  }
}

function post(slug: string, opts: Partial<BlogPost> = {}): BlogPost {
  return {
    slug,
    title_fa: `عنوان ${slug}`,
    body_md: `متن ${slug}`,
    status: "draft",
    published_at: null,
    updated_at: "2026-08-01T00:00:00.000Z",
    ...opts,
  };
}

function seedFake(...posts: BlogPost[]): FakeAdminPostsSource {
  const fake = new FakeAdminPostsSource();
  for (const p of posts) fake.seed(p);
  setAdminPostsSource(fake);
  return fake;
}

afterEach(() => {
  resetAdminPostsSource();
});

describe("isValidSlug", () => {
  it("همان شکل اسلاگ جدول posts را می‌پذیرد", () => {
    expect(isValidSlug("hazine-panhan")).toBe(true);
    expect(isValidSlug("a1-b2-c3")).toBe(true);
  });

  it("شکل نادرست را رد می‌کند", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Hazine")).toBe(false);
    expect(isValidSlug("hazine_panhan")).toBe(false);
    expect(isValidSlug("-hazine")).toBe(false);
    expect(isValidSlug("hazine-")).toBe(false);
    expect(isValidSlug("هزینه")).toBe(false);
  });
});

describe("nextUpdatedAt", () => {
  const current = "2026-08-01T00:00:00.000Z";
  const now = "2026-08-07T12:00:00.000Z";

  it("meaningfulEdit=false ⟸ current دست‌نخورده برمی‌گردد", () => {
    expect(nextUpdatedAt(current, false, now)).toBe(current);
  });

  it("meaningfulEdit=true ⟸ now برمی‌گردد", () => {
    expect(nextUpdatedAt(current, true, now)).toBe(now);
  });
});

describe("createPost", () => {
  it("اسلاگ بدشکل ⟸ رد می‌شود، چیزی insert نمی‌شود", async () => {
    const fake = seedFake();
    const result = await createPost(
      { slug: "Bad Slug", title_fa: "عنوان", body_md: "متن" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
    expect(fake.inserted).toHaveLength(0);
  });

  it("اسلاگ تکراری ⟸ رد می‌شود، پست موجود بازنویسی نمی‌شود", async () => {
    const fake = seedFake(post("takrari", { title_fa: "قدیمی" }));
    const result = await createPost(
      { slug: "takrari", title_fa: "تازه", body_md: "متن تازه" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
    expect(fake.inserted).toHaveLength(0);
    expect((await getAdminPost("takrari"))?.title_fa).toBe("قدیمی");
  });

  it("عنوان/متن خالی ⟸ رد می‌شود", async () => {
    seedFake();
    const result = await createPost(
      { slug: "khali", title_fa: "  ", body_md: "متن" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
  });

  it("موفق ⟸ status=draft، published_at=null، updated_at=now", async () => {
    const fake = seedFake();
    const now = "2026-08-07T00:00:00.000Z";
    const result = await createPost(
      { slug: "post-tazeh", title_fa: "عنوان تازه", body_md: "متن تازه" },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post).toEqual({
      slug: "post-tazeh",
      title_fa: "عنوان تازه",
      body_md: "متن تازه",
      status: "draft",
      published_at: null,
      updated_at: now,
    });
    expect(fake.inserted).toHaveLength(1);
  });

  it("همه‌ی پست‌ها با هر وضعیتی در فهرست هستند", async () => {
    seedFake(
      post("p1", { status: "draft" }),
      post("p2", { status: "published", published_at: "2026-08-01T00:00:00.000Z" }),
      post("p3", { status: "retracted", published_at: "2026-08-01T00:00:00.000Z" }),
    );
    const all = await listAllPosts();
    expect(all.map((p) => p.slug).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("updatePost", () => {
  it("پست ناموجود ⟸ kind=not_found", async () => {
    seedFake();
    const result = await updatePost(
      "nist",
      { title_fa: "ت", body_md: "م", meaningfulEdit: false },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("پیش‌نویس ⟸ updated_at هرگز جلو نمی‌رود، حتی با meaningfulEdit=true", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(post("pre-nevis", { status: "draft", updated_at: original }));
    const result = await updatePost(
      "pre-nevis",
      { title_fa: "عنوان تازه", body_md: "متن تازه", meaningfulEdit: true },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.updated_at).toBe(original);
    expect(result.post.title_fa).toBe("عنوان تازه");
  });

  it("منتشرشده بدون تیک ⟸ updated_at جلو نمی‌رود", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(
      post("montasher", {
        status: "published",
        published_at: original,
        updated_at: original,
      }),
    );
    const result = await updatePost(
      "montasher",
      { title_fa: "غلط‌گیری جزئی", body_md: "متن", meaningfulEdit: false },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.updated_at).toBe(original);
  });

  it("منتشرشده با تیک صریح ⟸ updated_at جلو می‌رود", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    const now = "2026-08-07T00:00:00.000Z";
    seedFake(
      post("montasher2", {
        status: "published",
        published_at: original,
        updated_at: original,
      }),
    );
    const result = await updatePost(
      "montasher2",
      { title_fa: "ویرایش معنادار", body_md: "متن", meaningfulEdit: true },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.updated_at).toBe(now);
  });
});

describe("publishPost", () => {
  it("پست ناموجود ⟸ kind=not_found", async () => {
    seedFake();
    const result = await publishPost("nist", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("پیش‌نویس ⟸ status=published، published_at=now، updated_at=now", async () => {
    seedFake(post("pre-nevis", { status: "draft", published_at: null }));
    const now = "2026-08-07T00:00:00.000Z";
    const result = await publishPost("pre-nevis", now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.status).toBe("published");
    expect(result.post.published_at).toBe(now);
    expect(result.post.updated_at).toBe(now);
  });

  it("از قبل منتشرشده ⟸ رد می‌شود", async () => {
    seedFake(
      post("montasher", {
        status: "published",
        published_at: "2026-08-01T00:00:00.000Z",
      }),
    );
    const result = await publishPost("montasher", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(false);
  });

  it("پس‌گرفته‌شده دوباره منتشر می‌شود و published_at قدیمی‌اش را حفظ می‌کند", async () => {
    const firstPublish = "2026-07-01T00:00:00.000Z";
    seedFake(
      post("bargasht", {
        status: "retracted",
        published_at: firstPublish,
        updated_at: firstPublish,
      }),
    );
    const now = "2026-08-07T00:00:00.000Z";
    const result = await publishPost("bargasht", now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.published_at).toBe(firstPublish);
    expect(result.post.updated_at).toBe(now);
  });
});

describe("retractPost", () => {
  it("پست ناموجود ⟸ kind=not_found", async () => {
    seedFake();
    const result = await retractPost("nist");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("پیش‌نویس ⟸ رد می‌شود (فقط منتشرشده پس گرفته می‌شود)", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const result = await retractPost("pre-nevis");
    expect(result.ok).toBe(false);
  });

  it("منتشرشده ⟸ status=retracted، updated_at دست‌نخورده می‌ماند", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(
      post("montasher", {
        status: "published",
        published_at: original,
        updated_at: original,
      }),
    );
    const result = await retractPost("montasher");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.status).toBe("retracted");
    expect(result.post.updated_at).toBe(original);
    expect(result.post.published_at).toBe(original);
  });
});
