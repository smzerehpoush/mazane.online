import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "../src/lib/admin-auth";
import {
  resetAdminPostsSource,
  setAdminPostsSource,
  type AdminPostsSource,
  type PostImagePatch,
} from "../src/lib/admin-posts";
import type { BlogPost, PostStatus } from "../src/lib/blog";
import {
  adminPostGetResponse,
  adminPostMethodNotAllowed,
  adminPostPublishResponse,
  adminPostRetractResponse,
  adminPostUpdateResponse,
  adminPostsCreateResponse,
  adminPostsListResponse,
  adminPostsMethodNotAllowed,
} from "../src/lib/server/admin-posts-requests";
import { ADMIN_SESSION_COOKIE } from "../src/lib/server/admin-session";

const SECRET = "test-session-secret";

class FakeAdminPostsSource implements AdminPostsSource {
  posts = new Map<string, BlogPost>();
  inserted: BlogPost[] = [];

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

function authedRequest(url: string, method: string, body?: unknown): Request {
  const token = createSessionToken(SECRET, Date.now());
  return new Request(url, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

function anonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

const LIST_URL = "https://tablo.gold/api/admin-posts";
const slugUrl = (slug: string) => `https://tablo.gold/api/admin-posts/${slug}`;

beforeEach(() => {
  vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetAdminPostsSource();
});

describe("without a valid session", () => {
  it("all endpoints return 401", async () => {
    seedFake(post("p1"));
    const responses = [
      await adminPostsListResponse(anonRequest(LIST_URL, "GET")),
      await adminPostsCreateResponse(
        anonRequest(LIST_URL, "POST", { slug: "x", title_fa: "ت", body_md: "م" }),
      ),
      await adminPostGetResponse(anonRequest(slugUrl("p1"), "GET"), "p1"),
      await adminPostUpdateResponse(
        anonRequest(slugUrl("p1"), "POST", {
          title_fa: "ت",
          body_md: "م",
          meaningfulEdit: false,
        }),
        "p1",
      ),
      await adminPostPublishResponse(anonRequest(slugUrl("p1") + "/publish", "POST"), "p1"),
      await adminPostRetractResponse(anonRequest(slugUrl("p1") + "/retract", "POST"), "p1"),
    ];
    for (const response of responses) expect(response.status).toBe(401);
  });
});

describe("GET /api/admin-posts", () => {
  it("returns the list of all statuses", async () => {
    seedFake(
      post("p1", { status: "draft" }),
      post("p2", { status: "published", published_at: "2026-08-01T00:00:00.000Z" }),
      post("p3", { status: "retracted", published_at: "2026-08-01T00:00:00.000Z" }),
    );
    const response = await adminPostsListResponse(authedRequest(LIST_URL, "GET"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { posts: BlogPost[] };
    expect(body.posts.map((p) => p.slug).sort()).toEqual(["p1", "p2", "p3"]);
  });
});

describe("POST /api/admin-posts", () => {
  it("malformed slug ⟸ 400, nothing is inserted", async () => {
    const fake = seedFake();
    const response = await adminPostsCreateResponse(
      authedRequest(LIST_URL, "POST", { slug: "Bad Slug", title_fa: "ت", body_md: "م" }),
    );
    expect(response.status).toBe(400);
    expect(fake.inserted).toHaveLength(0);
  });

  it("duplicate slug ⟸ 400, the existing post is not overwritten", async () => {
    const fake = seedFake(post("takrari", { title_fa: "قدیمی" }));
    const response = await adminPostsCreateResponse(
      authedRequest(LIST_URL, "POST", { slug: "takrari", title_fa: "تازه", body_md: "متن" }),
    );
    expect(response.status).toBe(400);
    expect(fake.inserted).toHaveLength(0);
    expect(fake.posts.get("takrari")?.title_fa).toBe("قدیمی");
  });

  it("invalid body ⟸ 400", async () => {
    seedFake();
    expect(
      (await adminPostsCreateResponse(authedRequest(LIST_URL, "POST", "{ نه JSON"))).status,
    ).toBe(400);
    expect(
      (await adminPostsCreateResponse(authedRequest(LIST_URL, "POST", { slug: "x" }))).status,
    ).toBe(400);
  });

  it("success ⟸ 201, status=draft", async () => {
    const fake = seedFake();
    const response = await adminPostsCreateResponse(
      authedRequest(LIST_URL, "POST", {
        slug: "post-tazeh",
        title_fa: "عنوان",
        body_md: "متن",
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.status).toBe("draft");
    expect(body.post.published_at).toBeNull();
    expect(fake.inserted).toHaveLength(1);
  });
});

describe("GET /api/admin-posts/$slug", () => {
  it("nonexistent post ⟸ 404", async () => {
    seedFake();
    const response = await adminPostGetResponse(authedRequest(slugUrl("nist"), "GET"), "nist");
    expect(response.status).toBe(404);
  });

  it("existing post regardless of status ⟸ 200", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const response = await adminPostGetResponse(
      authedRequest(slugUrl("pre-nevis"), "GET"),
      "pre-nevis",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.slug).toBe("pre-nevis");
  });
});

describe("POST /api/admin-posts/$slug — edit", () => {
  it("nonexistent post ⟸ 404", async () => {
    seedFake();
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("nist"), "POST", {
        title_fa: "ت",
        body_md: "م",
        meaningfulEdit: false,
      }),
      "nist",
    );
    expect(response.status).toBe(404);
  });

  it("invalid body ⟸ 400", async () => {
    seedFake(post("p1"));
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("p1"), "POST", { title_fa: "ت" }),
      "p1",
    );
    expect(response.status).toBe(400);
  });

  it("draft ⟸ updated_at does not advance, even with meaningfulEdit=true", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(post("pre-nevis", { status: "draft", updated_at: original }));
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("pre-nevis"), "POST", {
        title_fa: "غلط‌گیری",
        body_md: "متن تازه",
        meaningfulEdit: true,
      }),
      "pre-nevis",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.updated_at).toBe(original);
  });

  it("published without the checkbox ⟸ updated_at does not advance", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(
      post("montasher", { status: "published", published_at: original, updated_at: original }),
    );
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("montasher"), "POST", {
        title_fa: "غلط‌گیری",
        body_md: "متن",
        meaningfulEdit: false,
      }),
      "montasher",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.updated_at).toBe(original);
  });

  it("published with the checkbox explicitly checked ⟸ updated_at advances", async () => {
    const original = "2026-08-01T00:00:00.000Z";
    seedFake(
      post("montasher2", { status: "published", published_at: original, updated_at: original }),
    );
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("montasher2"), "POST", {
        title_fa: "ویرایش معنادار",
        body_md: "متن",
        meaningfulEdit: true,
      }),
      "montasher2",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.updated_at).not.toBe(original);
  });
});

describe("POST /api/admin-posts/$slug/publish", () => {
  it("nonexistent post ⟸ 404", async () => {
    seedFake();
    const response = await adminPostPublishResponse(
      authedRequest(slugUrl("nist") + "/publish", "POST"),
      "nist",
    );
    expect(response.status).toBe(404);
  });

  it("draft ⟸ 200, status=published", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const response = await adminPostPublishResponse(
      authedRequest(slugUrl("pre-nevis") + "/publish", "POST"),
      "pre-nevis",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.status).toBe("published");
    expect(body.post.published_at).not.toBeNull();
  });

  it("already published ⟸ 400", async () => {
    seedFake(
      post("montasher", {
        status: "published",
        published_at: "2026-08-01T00:00:00.000Z",
      }),
    );
    const response = await adminPostPublishResponse(
      authedRequest(slugUrl("montasher") + "/publish", "POST"),
      "montasher",
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/admin-posts/$slug/retract", () => {
  it("nonexistent post ⟸ 404", async () => {
    seedFake();
    const response = await adminPostRetractResponse(
      authedRequest(slugUrl("nist") + "/retract", "POST"),
      "nist",
    );
    expect(response.status).toBe(404);
  });

  it("published ⟸ 200, status=retracted", async () => {
    seedFake(
      post("montasher", {
        status: "published",
        published_at: "2026-08-01T00:00:00.000Z",
      }),
    );
    const response = await adminPostRetractResponse(
      authedRequest(slugUrl("montasher") + "/retract", "POST"),
      "montasher",
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { post: BlogPost };
    expect(body.post.status).toBe("retracted");
  });

  it("draft ⟸ 400 (only published posts can be retracted)", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const response = await adminPostRetractResponse(
      authedRequest(slugUrl("pre-nevis") + "/retract", "POST"),
      "pre-nevis",
    );
    expect(response.status).toBe(400);
  });
});

describe("other method ⟸ 405 with Allow header", () => {
  it("admin-posts", () => {
    const response = adminPostsMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("admin-posts/$slug", () => {
    const response = adminPostMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });
});

describe("all responses are uncached and non-indexable", () => {
  it("headers are identical on success and error", async () => {
    seedFake(post("p1", { status: "published", published_at: "2026-08-01T00:00:00.000Z" }));
    const responses = [
      await adminPostsListResponse(anonRequest(LIST_URL, "GET")),
      await adminPostsListResponse(authedRequest(LIST_URL, "GET")),
      await adminPostGetResponse(authedRequest(slugUrl("p1"), "GET"), "p1"),
      adminPostsMethodNotAllowed(),
    ];
    for (const response of responses) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });
});
