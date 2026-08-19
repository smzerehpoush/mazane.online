import { PostImage } from "@/components/content/PostImage";
import type { PublishedPost } from "@/lib/blog";
import { postExcerpt } from "./home-view";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";

export function PopularPosts({
  posts,
  rankedByViews = false,
}: {
  posts: PublishedPost[];
  rankedByViews?: boolean;
}) {
  return (
    <section aria-labelledby="more-posts-heading">
      <h2 id="more-posts-heading" className="text-title font-semibold">
        {rankedByViews ? "پرخواننده‌ترین نوشته‌ها" : "بیشتر بخوانید"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const image = postImageAsset(post);
          return (
            <article key={post.slug} className="card-surface lift-hover flex flex-col p-5">
              {image !== null ? (
                <PostImage
                  image={image}
                  sizes="(min-width: 1024px) 421px, (min-width: 640px) 45vw, 100vw"
                  loading="lazy"
                  className="mb-4 aspect-video w-full rounded-xl object-cover"
                />
              ) : null}
              <h3 className="text-body font-semibold">
                <a href={`/blog/${post.slug}`} className="transition-smooth hover:text-primary">
                  {post.title_fa}
                </a>
              </h3>
              <p className="mt-2 line-clamp-2 text-body text-muted-foreground">
                {postExcerpt(post.body_md)}
              </p>
              <div className="mt-4 text-meta text-muted-foreground">
                <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
