export type PostStatus = "draft" | "published" | "retracted";

export interface BlogPost {
  slug: string;
  title_fa: string;
  body_md: string;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
  image_url?: string | null;
  image_alt?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  image_srcset?: string | null;
}

export interface PublishedPost extends BlogPost {
  status: "published";
  published_at: string;
}

export interface BlogSource {
  listPosts(): Promise<BlogPost[]>;
  getPost(slug: string): Promise<BlogPost | null>;
}

export type BlogSourceFactory = () => BlogSource;

let activeSource: BlogSource | null = null;
let defaultFactory: BlogSourceFactory | null = null;

export function setBlogSource(source: BlogSource): void {
  activeSource = source;
}

export function setDefaultBlogSource(factory: BlogSourceFactory): void {
  defaultFactory = factory;
}

function source(): BlogSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      'No BlogSource registered — import from "@/lib/server/blog-source" or call setBlogSource',
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

function isPublished(post: BlogPost): post is PublishedPost {
  return post.status === "published" && post.published_at !== null;
}

export async function listPublishedPosts(): Promise<PublishedPost[]> {
  try {
    return await listPublishedPostsStrict();
  } catch (error) {
    console.error("blog source unavailable; rendering empty list", error);
    return [];
  }
}

export async function listPublishedPostsStrict(): Promise<PublishedPost[]> {
  const posts = await source().listPosts();
  return posts
    .filter(isPublished)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export async function getPublishedPost(slug: string): Promise<PublishedPost | null> {
  const post = await source().getPost(slug);
  if (post === null || !isPublished(post)) return null;
  return post;
}
