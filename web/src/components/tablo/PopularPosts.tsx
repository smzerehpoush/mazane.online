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
            /*
             * ⚠️ One card, two shapes. On a phone these three cards are the
             * last thing between the reader and the footer, and as stacked
             * 16:9 cards they were taller than the price section itself —
             * so below `sm` the same markup lays out as a thumbnail row and
             * the excerpt is left out of the flow. Not out of the HTML:
             * `hidden` keeps the text crawlable and keeps one DOM for both
             * breakpoints.
             */
            <article
              key={post.slug}
              className="card-surface lift-hover flex flex-row items-center gap-3.5 p-3.5 sm:flex-col sm:items-stretch sm:p-5"
            >
              {image !== null ? (
                <PostImage
                  image={image}
                  sizes="(min-width: 1024px) 421px, (min-width: 640px) 45vw, 96px"
                  loading="lazy"
                  className="size-20 shrink-0 rounded-xl object-cover sm:mb-4 sm:aspect-video sm:size-auto sm:w-full"
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="text-body leading-snug font-semibold sm:leading-normal">
                  <a href={`/blog/${post.slug}`} className="transition-smooth hover:text-primary">
                    {post.title_fa}
                  </a>
                </h3>
                <p className="mt-2 hidden line-clamp-2 text-body text-muted-foreground sm:block">
                  {postExcerpt(post.body_md)}
                </p>
                <div className="mt-1.5 text-meta text-muted-foreground sm:mt-4">
                  <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
