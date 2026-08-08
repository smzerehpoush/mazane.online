/**
 * مرز وب — نوشتن پست در پنل (بلیت ۲۲): منبع تزریق‌شده ⟸ پاسخ endpoint.
 *
 * همان مرز `post-view.ts`/`admin-platform-settings.ts`: منطق در
 * `lib/server/admin-posts-requests.ts` مستقیم از تست صدا زده می‌شود، بدون
 * بالا آوردن سرور یا اتصال واقعی به پستگرس — منبع دامنه
 * (`lib/admin-posts.ts::setAdminPostsSource`) با فیک درون‌حافظه‌ای seed می‌شود.
 *
 * سنجیده می‌شود:
 *   ۱. بدون نشست معتبر ⟸ ۴۰۱ روی همه‌ی endpointها.
 *   ۲. فهرست همه‌ی وضعیت‌ها را می‌دهد.
 *   ۳. ساخت: اسلاگ بدشکل/تکراری ⟸ ۴۰۰، چیزی insert نمی‌شود.
 *   ۴. ویرایش: پیش‌نویس هرگز updated_at را جلو نمی‌برد؛ منتشرشده فقط با
 *      meaningfulEdit===true جلو می‌رود.
 *   ۵. انتشار/پس‌گیری: گذار وضعیت درست، پست ناموجود ⟸ ۴۰۴.
 *   ۶. همه‌ی پاسخ‌ها بی‌کش و بدون اجازه‌ی نمایه‌سازی‌اند.
 */
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

const LIST_URL = "https://mazane.online/api/admin-posts";
const slugUrl = (slug: string) => `https://mazane.online/api/admin-posts/${slug}`;

beforeEach(() => {
  vi.stubEnv("MAZANE_ADMIN_SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetAdminPostsSource();
});

describe("بدون نشست معتبر", () => {
  it("همه‌ی endpointها ۴۰۱ می‌دهند", async () => {
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
  it("فهرست همه‌ی وضعیت‌ها را می‌دهد", async () => {
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
  it("اسلاگ بدشکل ⟸ ۴۰۰، چیزی insert نمی‌شود", async () => {
    const fake = seedFake();
    const response = await adminPostsCreateResponse(
      authedRequest(LIST_URL, "POST", { slug: "Bad Slug", title_fa: "ت", body_md: "م" }),
    );
    expect(response.status).toBe(400);
    expect(fake.inserted).toHaveLength(0);
  });

  it("اسلاگ تکراری ⟸ ۴۰۰، پست موجود بازنویسی نمی‌شود", async () => {
    const fake = seedFake(post("takrari", { title_fa: "قدیمی" }));
    const response = await adminPostsCreateResponse(
      authedRequest(LIST_URL, "POST", { slug: "takrari", title_fa: "تازه", body_md: "متن" }),
    );
    expect(response.status).toBe(400);
    expect(fake.inserted).toHaveLength(0);
    expect(fake.posts.get("takrari")?.title_fa).toBe("قدیمی");
  });

  it("بدنه‌ی نامعتبر ⟸ ۴۰۰", async () => {
    seedFake();
    expect(
      (await adminPostsCreateResponse(authedRequest(LIST_URL, "POST", "{ نه JSON"))).status,
    ).toBe(400);
    expect(
      (await adminPostsCreateResponse(authedRequest(LIST_URL, "POST", { slug: "x" }))).status,
    ).toBe(400);
  });

  it("موفق ⟸ ۲۰۱، status=draft", async () => {
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
  it("پست ناموجود ⟸ ۴۰۴", async () => {
    seedFake();
    const response = await adminPostGetResponse(authedRequest(slugUrl("nist"), "GET"), "nist");
    expect(response.status).toBe(404);
  });

  it("پست موجود با هر وضعیتی ⟸ ۲۰۰", async () => {
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

describe("POST /api/admin-posts/$slug — ویرایش", () => {
  it("پست ناموجود ⟸ ۴۰۴", async () => {
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

  it("بدنه‌ی نامعتبر ⟸ ۴۰۰", async () => {
    seedFake(post("p1"));
    const response = await adminPostUpdateResponse(
      authedRequest(slugUrl("p1"), "POST", { title_fa: "ت" }),
      "p1",
    );
    expect(response.status).toBe(400);
  });

  it("پیش‌نویس ⟸ updated_at جلو نمی‌رود، حتی با meaningfulEdit=true", async () => {
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

  it("منتشرشده بدون تیک ⟸ updated_at جلو نمی‌رود", async () => {
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

  it("منتشرشده با تیک صریح ⟸ updated_at جلو می‌رود", async () => {
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
  it("پست ناموجود ⟸ ۴۰۴", async () => {
    seedFake();
    const response = await adminPostPublishResponse(
      authedRequest(slugUrl("nist") + "/publish", "POST"),
      "nist",
    );
    expect(response.status).toBe(404);
  });

  it("پیش‌نویس ⟸ ۲۰۰، status=published", async () => {
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

  it("از قبل منتشرشده ⟸ ۴۰۰", async () => {
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
  it("پست ناموجود ⟸ ۴۰۴", async () => {
    seedFake();
    const response = await adminPostRetractResponse(
      authedRequest(slugUrl("nist") + "/retract", "POST"),
      "nist",
    );
    expect(response.status).toBe(404);
  });

  it("منتشرشده ⟸ ۲۰۰، status=retracted", async () => {
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

  it("پیش‌نویس ⟸ ۴۰۰ (فقط منتشرشده پس گرفته می‌شود)", async () => {
    seedFake(post("pre-nevis", { status: "draft" }));
    const response = await adminPostRetractResponse(
      authedRequest(slugUrl("pre-nevis") + "/retract", "POST"),
      "pre-nevis",
    );
    expect(response.status).toBe(400);
  });
});

describe("متد دیگر ⟸ ۴۰۵ با هدر Allow", () => {
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

describe("همه‌ی پاسخ‌ها بی‌کش و بدون اجازه‌ی نمایه‌سازی‌اند", () => {
  it("هدرها روی موفق و خطا یکسان‌اند", async () => {
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
