import { PostImage } from "@/components/content/PostImage";
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";

export function Sidebar({ posts }: { posts: PublishedPost[] }) {
  return (
    <aside className="card-surface p-5 sm:p-7">
      <h2 className="text-title font-semibold">تازه‌ترین نوشته‌ها</h2>
      <ul className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
        {posts.map((post, index) => {
          const image = postImageAsset(post);
          return (
            <li
              key={post.slug}
              className="border-b border-border/60 pb-4 last:border-0 last:pb-0 sm:pb-5"
            >
              <a
                href={`/blog/${post.slug}`}
                className={`transition-smooth group flex items-center gap-4 hover:text-primary ${
                  index % 2 === 1 ? "flex-row-reverse" : ""
                }`}
              >
                {image !== null ? (
                  <PostImage
                    image={image}
                    sizes="(min-width: 640px) 80px, 64px"
                    loading="lazy"
                    className="transition-smooth size-16 shrink-0 rounded-2xl border border-border/70 object-cover shadow-soft group-hover:shadow-card sm:size-20"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="transition-smooth size-16 shrink-0 rounded-2xl border border-border/70 bg-surface-2 shadow-soft group-hover:shadow-card sm:size-20"
                    style={{
                      background:
                        "linear-gradient(140deg, color-mix(in oklab, var(--color-primary) 14%, var(--color-surface)), var(--color-surface-2))",
                    }}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{post.title_fa}</span>
                  <span className="mt-1.5 block text-meta text-muted-foreground">
                    <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
