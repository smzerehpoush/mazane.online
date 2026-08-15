// ⚠️ `posts.updated_at` only advances on a meaningful content change plus the
// user's explicit checkbox; never automatically with `now` or when saving a
// draft. The client's checkbox is also never trusted directly.

import type { BlogPost, PostStatus } from "./blog";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export interface CreatePostInput {
  slug: string;
  title_fa: string;
  body_md: string;
}

export interface UpdatePostInput {
  title_fa: string;
  body_md: string;
  meaningfulEdit: boolean;
}

export type WriteFailure = { ok: false; kind: "not_found" | "invalid"; error: string };
export type WriteResult = { ok: true; post: BlogPost } | WriteFailure;

export interface PostImagePatch {
  image_url: string;
  image_alt: string;
  image_width: number;
  image_height: number;
}

export interface AdminPostsSource {
  listPosts(): Promise<BlogPost[]>;
  getPost(slug: string): Promise<BlogPost | null>;
  insertPost(post: BlogPost): Promise<void>;
  updatePost(
    slug: string,
    patch: { title_fa: string; body_md: string; updated_at: string },
  ): Promise<void>;
  setStatus(
    slug: string,
    patch: { status: PostStatus; published_at: string | null; updated_at: string },
  ): Promise<void>;
  setImage(slug: string, patch: PostImagePatch): Promise<void>;
}

export type AdminPostsFactory = () => AdminPostsSource;

let activeSource: AdminPostsSource | null = null;
let defaultFactory: AdminPostsFactory | null = null;

export function setAdminPostsSource(source: AdminPostsSource): void {
  activeSource = source;
}

export function setDefaultAdminPostsSource(factory: AdminPostsFactory): void {
  defaultFactory = factory;
}

export function resetAdminPostsSource(): void {
  activeSource = null;
}

function source(): AdminPostsSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      'No AdminPostsSource registered — import from "@/lib/server/admin-posts" or call setAdminPostsSource',
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

export function nextUpdatedAt(current: string, meaningfulEdit: boolean, now: string): string {
  return meaningfulEdit ? now : current;
}

function invalid(error: string): WriteFailure {
  return { ok: false, kind: "invalid", error };
}

function notFoundFailure(): WriteFailure {
  return { ok: false, kind: "not_found", error: "پست پیدا نشد" };
}

function validateTitleAndBody(title_fa: string, body_md: string): string | null {
  if (title_fa.trim() === "") return "عنوان نمی‌تواند خالی باشد";
  if (body_md.trim() === "") return "متن نمی‌تواند خالی باشد";
  return null;
}

export async function listAllPosts(): Promise<BlogPost[]> {
  return source().listPosts();
}

export async function getAdminPost(slug: string): Promise<BlogPost | null> {
  return source().getPost(slug);
}

export async function createPost(input: CreatePostInput, now: string): Promise<WriteResult> {
  if (!isValidSlug(input.slug)) {
    return invalid("اسلاگ باید فقط حروف لاتین کوچک، رقم و خط‌تیره‌ی میانی باشد");
  }
  const fieldError = validateTitleAndBody(input.title_fa, input.body_md);
  if (fieldError !== null) return invalid(fieldError);

  const src = source();
  const existing = await src.getPost(input.slug);
  if (existing !== null) return invalid("این اسلاگ قبلاً استفاده شده است");

  const post: BlogPost = {
    slug: input.slug,
    title_fa: input.title_fa,
    body_md: input.body_md,
    status: "draft",
    published_at: null,
    updated_at: now,
    image_url: null,
    image_alt: null,
    image_width: null,
    image_height: null,
  };
  await src.insertPost(post);
  return { ok: true, post };
}

export async function updatePost(
  slug: string,
  input: UpdatePostInput,
  now: string,
): Promise<WriteResult> {
  const fieldError = validateTitleAndBody(input.title_fa, input.body_md);
  if (fieldError !== null) return invalid(fieldError);

  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();

  const meaningful = existing.status === "published" && input.meaningfulEdit === true;
  const updated_at = nextUpdatedAt(existing.updated_at, meaningful, now);

  await src.updatePost(slug, { title_fa: input.title_fa, body_md: input.body_md, updated_at });
  return {
    ok: true,
    post: { ...existing, title_fa: input.title_fa, body_md: input.body_md, updated_at },
  };
}

export async function publishPost(slug: string, now: string): Promise<WriteResult> {
  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();
  if (existing.status === "published") return invalid("پست از قبل منتشر شده است");

  const published_at = existing.published_at ?? now;
  const updated_at = now;
  await src.setStatus(slug, { status: "published", published_at, updated_at });
  return { ok: true, post: { ...existing, status: "published", published_at, updated_at } };
}

export async function retractPost(slug: string): Promise<WriteResult> {
  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();
  if (existing.status !== "published") return invalid("فقط پست منتشرشده را می‌توان پس گرفت");

  await src.setStatus(slug, {
    status: "retracted",
    published_at: existing.published_at,
    updated_at: existing.updated_at,
  });
  return { ok: true, post: { ...existing, status: "retracted" } };
}

export async function setPostImage(slug: string, image: PostImagePatch): Promise<WriteResult> {
  if (image.image_alt.trim() === "") return invalid("متن جایگزین عکس نمی‌تواند خالی باشد");
  if (image.image_width <= 0 || image.image_height <= 0) {
    return invalid("ابعاد عکس نامعتبر است");
  }

  const src = source();
  const existing = await src.getPost(slug);
  if (existing === null) return notFoundFailure();

  await src.setImage(slug, image);
  return { ok: true, post: { ...existing, ...image } };
}
