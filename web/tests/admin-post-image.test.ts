import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "../src/lib/admin-auth";
import {
  resetAdminPostsSource,
  setAdminPostsSource,
  type AdminPostsSource,
  type PostImagePatch,
} from "../src/lib/admin-posts";
import type { BlogPost, PostStatus } from "../src/lib/blog";
import { resetImageStore } from "../src/lib/images";
import {
  adminPostImageMethodNotAllowed,
  adminPostImageUploadResponse,
} from "../src/lib/server/admin-post-image";
import { ADMIN_SESSION_COOKIE } from "../src/lib/server/admin-session";
import { seedBrokenImageStore, seedImageStore } from "./support/seed";

const SECRET = "test-session-secret";
const S3_ENDPOINT = "https://s3.tablo.test";
const S3_BUCKET = "tablo-media";
const PUBLIC_BASE = `${S3_ENDPOINT}/${S3_BUCKET}`;

class FakeAdminPostsSource implements AdminPostsSource {
  posts = new Map<string, BlogPost>();
  imageChanges: { slug: string; patch: PostImagePatch }[] = [];

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
    this.posts.set(post.slug, post);
  }

  async updatePost(
    slug: string,
    patch: { title_fa: string; body_md: string; updated_at: string },
  ): Promise<void> {
    const existing = this.posts.get(slug);
    if (existing !== undefined) this.posts.set(slug, { ...existing, ...patch });
  }

  async setStatus(
    slug: string,
    patch: { status: PostStatus; published_at: string | null; updated_at: string },
  ): Promise<void> {
    const existing = this.posts.get(slug);
    if (existing !== undefined) this.posts.set(slug, { ...existing, ...patch });
  }

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

const URL_FOR = (slug: string) => `https://tablo.gold/api/admin-posts/${slug}/image`;

function form(opts: { alt?: string; fileBytes?: Uint8Array; fileType?: string } = {}): FormData {
  const fd = new FormData();
  if (opts.alt !== undefined) fd.append("alt", opts.alt);
  if (opts.fileBytes !== undefined) {
    fd.append(
      "image",
      new Blob([Buffer.from(opts.fileBytes)], { type: opts.fileType ?? "image/jpeg" }),
      "akkas.jpg",
    );
  }
  return fd;
}

function authedRequest(
  slug: string,
  body: FormData,
  extraHeaders: Record<string, string> = {},
): Request {
  const token = createSessionToken(SECRET, Date.now());
  return new Request(URL_FOR(slug), {
    method: "POST",
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}`, ...extraHeaders },
    body,
  });
}

function anonRequest(slug: string, body: FormData): Request {
  return new Request(URL_FOR(slug), { method: "POST", body });
}

const SMALL_IMAGE = new Uint8Array([1, 2, 3, 4, 5]);

beforeEach(() => {
  vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
  vi.stubEnv("TABLO_ARVAN_S3_ENDPOINT", S3_ENDPOINT);
  vi.stubEnv("TABLO_ARVAN_S3_BUCKET", S3_BUCKET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetAdminPostsSource();
  resetImageStore();
});

describe("without a valid session", () => {
  it("returns 401 and the image store is not called", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    const response = await adminPostImageUploadResponse(
      anonRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(response.status).toBe(401);
    expect(store.uploads).toHaveLength(0);
  });
});

describe("slug", () => {
  it("malformed ⟸ 404", async () => {
    seedFake();
    seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("Bad Slug", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "Bad Slug",
    );
    expect(response.status).toBe(404);
  });

  it("nonexistent ⟸ 404", async () => {
    seedFake();
    const store = seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("nist", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "nist",
    );
    expect(response.status).toBe(404);
    expect(store.uploads).toHaveLength(0);
  });
});

describe("alt text", () => {
  it("missing ⟸ 400, upload is not called", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(response.status).toBe(400);
    expect(store.uploads).toHaveLength(0);
  });

  it("empty/whitespace-only ⟸ 400", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "   ", fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(response.status).toBe(400);
    expect(store.uploads).toHaveLength(0);
  });
});

describe("file", () => {
  it("missing ⟸ 400", async () => {
    seedFake(post("akkas"));
    seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن جایگزین" })),
      "akkas",
    );
    expect(response.status).toBe(400);
  });

  it("larger than the limit with Content-Length ⟸ 413 before reading the body", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE }), {
        "content-length": String(9 * 1024 * 1024),
      }),
      "akkas",
    );
    expect(response.status).toBe(413);
    expect(store.uploads).toHaveLength(0);
  });

  it("larger than the limit without a valid Content-Length ⟸ 413 after reading the buffer", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    const huge = new Uint8Array(8 * 1024 * 1024 + 1);
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: huge })),
      "akkas",
    );
    expect(response.status).toBe(413);
    expect(store.uploads).toHaveLength(0);
  });
});

describe("successful upload", () => {
  it("200, and image_url/alt/width/height are set on the post; the response is uncached", async () => {
    const fake = seedFake(
      post("akkas", { status: "published", updated_at: "2026-08-01T00:00:00.000Z" }),
    );
    seedImageStore({ width: 1600, height: 900 });

    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "نمودار قیمت طلا روی موبایل", fileBytes: SMALL_IMAGE })),
      "akkas",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.image_url).toBe(`${PUBLIC_BASE}/posts/akkas/fake-hash.webp`);
    expect(body.post.image_alt).toBe("نمودار قیمت طلا روی موبایل");
    expect(body.post.image_width).toBe(1600);
    expect(body.post.image_height).toBe(900);
    expect(body.post.updated_at).toBe("2026-08-01T00:00:00.000Z");
    expect(fake.imageChanges).toHaveLength(1);
  });

  it("the bytes received by upload are exactly the uploaded file's bytes", async () => {
    seedFake(post("akkas"));
    const store = seedImageStore();
    await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0]?.slug).toBe("akkas");
    expect([...(store.uploads[0]?.bytes ?? [])]).toEqual([...SMALL_IMAGE]);
  });
});

describe("responsive variants", () => {
  it("the narrow copies and the full-size one become one ascending srcset", async () => {
    const fake = seedFake(post("akkas"));
    seedImageStore({
      width: 1600,
      height: 900,
      variants: [
        { objectKey: "posts/akkas/fake-hash-800.webp", width: 800 },
        { objectKey: "posts/akkas/fake-hash-160.webp", width: 160 },
      ],
    });

    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.image_srcset).toBe(
      `${PUBLIC_BASE}/posts/akkas/fake-hash-160.webp 160w, ` +
        `${PUBLIC_BASE}/posts/akkas/fake-hash-800.webp 800w, ` +
        `${PUBLIC_BASE}/posts/akkas/fake-hash.webp 1600w`,
    );
    expect(fake.imageChanges[0]?.patch.image_srcset).toBe(body.post.image_srcset);
  });

  /**
   * ⚠️ A store that reports no variants — an image narrower than every
   * variant width, or any upload predating ticket 78 — must produce a null
   * srcset, never a one-entry one pointing at objects that do not exist.
   */
  it("a store that reports no variants ⟸ srcset null, the post still gets its image", async () => {
    seedFake(post("akkas"));
    seedImageStore({ width: 120, height: 90 });

    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.image_srcset).toBeNull();
    expect(body.post.image_url).toBe(`${PUBLIC_BASE}/posts/akkas/fake-hash.webp`);
  });
});

describe("image store outage — staleness for the upload, not for the post text", () => {
  it("returns 502", async () => {
    seedFake(post("akkas"));
    seedBrokenImageStore();
    const response = await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(response.status).toBe(502);
  });

  it("post text remains untouched — setImage is never called", async () => {
    const fake = seedFake(post("akkas", { title_fa: "عنوان اصلی", body_md: "متن اصلی" }));
    seedBrokenImageStore();
    await adminPostImageUploadResponse(
      authedRequest("akkas", form({ alt: "متن", fileBytes: SMALL_IMAGE })),
      "akkas",
    );
    expect(fake.imageChanges).toHaveLength(0);
    expect(fake.posts.get("akkas")?.title_fa).toBe("عنوان اصلی");
    expect(fake.posts.get("akkas")?.body_md).toBe("متن اصلی");
  });
});

describe("other method", () => {
  it("405 with Allow header", () => {
    const response = adminPostImageMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
