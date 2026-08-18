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
  setPostImage,
  updatePost,
  type AdminPostsSource,
  type PostImagePatch,
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

  imageChanges: { slug: string; patch: PostImagePatch }[] = [];

  async setImage(slug: string, patch: PostImagePatch): Promise<void> {
    this.imageChanges.push({ slug, patch });
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
  it("accepts the same slug shape as the posts table", () => {
    expect(isValidSlug("hazine-panhan")).toBe(true);
    expect(isValidSlug("a1-b2-c3")).toBe(true);
  });

  it("rejects the wrong shape", () => {
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

  it("meaningfulEdit=false ⟸ returns current untouched", () => {
    expect(nextUpdatedAt(current, false, now)).toBe(current);
  });

  it("meaningfulEdit=true ⟸ returns now", () => {
    expect(nextUpdatedAt(current, true, now)).toBe(now);
  });
});

describe("createPost", () => {
  it("malformed slug ⟸ rejected, nothing is inserted", async () => {
    const fake = seedFake();
    const result = await createPost(
      { slug: "Bad Slug", title_fa: "عنوان", body_md: "متن" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
    expect(fake.inserted).toHaveLength(0);
  });

  it("duplicate slug ⟸ rejected, the existing post is not overwritten", async () => {
    const fake = seedFake(post("takrari", { title_fa: "قدیمی" }));
    const result = await createPost(
      { slug: "takrari", title_fa: "تازه", body_md: "متن تازه" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
    expect(fake.inserted).toHaveLength(0);
    expect((await getAdminPost("takrari"))?.title_fa).toBe("قدیمی");
  });

  it("empty title/body ⟸ rejected", async () => {
    seedFake();
    const result = await createPost(
      { slug: "khali", title_fa: "  ", body_md: "متن" },
      "2026-08-07T00:00:00.000Z",
    );
    expect(result.ok).toBe(false);
  });

  it("success ⟸ status=draft, published_at=null, updated_at=now", async () => {
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
      image_url: null,
      image_alt: null,
      image_width: null,
      image_height: null,
      image_srcset: null,
    });
    expect(fake.inserted).toHaveLength(1);
  });

  it("all posts, regardless of status, are in the list", async () => {
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
  it("nonexistent post ⟸ kind=not_found", async () => {
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

  it("draft ⟸ updated_at never advances, even with meaningfulEdit=true", async () => {
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

  it("published without the checkbox ⟸ updated_at does not advance", async () => {
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

  it("published with the checkbox explicitly checked ⟸ updated_at advances", async () => {
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
  it("nonexistent post ⟸ kind=not_found", async () => {
    seedFake();
    const result = await publishPost("nist", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("draft ⟸ status=published, published_at=now, updated_at=now", async () => {
    seedFake(post("pre-nevis", { status: "draft", published_at: null }));
    const now = "2026-08-07T00:00:00.000Z";
    const result = await publishPost("pre-nevis", now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.status).toBe("published");
    expect(result.post.published_at).toBe(now);
    expect(result.post.updated_at).toBe(now);
  });

  it("already published ⟸ rejected", async () => {
    seedFake(
      post("montasher", {
        status: "published",
        published_at: "2026-08-01T00:00:00.000Z",
      }),
    );
    const result = await publishPost("montasher", "2026-08-07T00:00:00.000Z");
    expect(result.ok).toBe(false);
  });

  it("a retracted post is published again and keeps its original published_at", async () => {
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
  it("nonexistent post ⟸ kind=not_found", async () => {
    seedFake();
    const result = await retractPost("nist");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("draft ⟸ rejected (only published posts can be retracted)", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const result = await retractPost("pre-nevis");
    expect(result.ok).toBe(false);
  });

  it("published ⟸ status=retracted, updated_at stays untouched", async () => {
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

describe("setPostImage", () => {
  const image: PostImagePatch = {
    image_url: "https://s3.tablo.test/tablo-media/posts/akkas/deadbeef.webp",
    image_alt: "نمودار قیمت طلا روی صفحه‌ی موبایل",
    image_width: 1600,
    image_height: 900,
  };

  it("nonexistent post ⟸ kind=not_found", async () => {
    seedFake();
    const result = await setPostImage("nist", image);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("not_found");
  });

  it("empty alt text ⟸ rejected, nothing is saved to the source", async () => {
    const fake = seedFake(post("akkas"));
    const result = await setPostImage("akkas", { ...image, image_alt: "   " });
    expect(result.ok).toBe(false);
    expect(fake.imageChanges).toHaveLength(0);
  });

  it("invalid dimensions ⟸ rejected", async () => {
    seedFake(post("akkas"));
    const result = await setPostImage("akkas", { ...image, image_width: 0 });
    expect(result.ok).toBe(false);
  });

  it("success ⟸ all four fields are set on the post, updated_at stays untouched", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    const fake = seedFake(post("akkas", { status: "published", updated_at: original }));
    const result = await setPostImage("akkas", image);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.image_url).toBe(image.image_url);
    expect(result.post.image_alt).toBe(image.image_alt);
    expect(result.post.image_width).toBe(image.image_width);
    expect(result.post.image_height).toBe(image.image_height);
    expect(result.post.updated_at).toBe(original);
    expect(fake.imageChanges).toEqual([{ slug: "akkas", patch: { ...image, image_srcset: null } }]);
  });

  it("an image with no variants clears the srcset a previous image left behind", async () => {
    const fake = seedFake(
      post("akkas", { image_srcset: "https://s3.tablo.test/old-480.webp 480w" }),
    );
    const result = await setPostImage("akkas", image);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.image_srcset).toBeNull();
    expect(fake.imageChanges[0]?.patch.image_srcset).toBeNull();
  });

  it("a srcset on the patch is handed to the source and to the returned post", async () => {
    const srcset = "https://s3.tablo.test/a-480.webp 480w, https://s3.tablo.test/a.webp 1600w";
    const fake = seedFake(post("akkas"));
    const result = await setPostImage("akkas", { ...image, image_srcset: srcset });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.post.image_srcset).toBe(srcset);
    expect(fake.imageChanges[0]?.patch.image_srcset).toBe(srcset);
  });

  it("saving post text (updatePost) never reaches setImage — separate paths", async () => {
    const fake = seedFake(post("akkas"));
    await updatePost(
      "akkas",
      { title_fa: "عنوان تازه", body_md: "متن تازه", meaningfulEdit: false },
      "2026-08-07T00:00:00.000Z",
    );
    expect(fake.imageChanges).toHaveLength(0);
  });
});
