import { PostImage } from "@/components/content/PostImage";
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";
import { postExcerpt } from "./home-view";

export function FeaturedPost({ post }: { post: PublishedPost }) {
  const image = postImageAsset(post);
  return (
    <section className="card-surface overflow-hidden" aria-labelledby="featured-post-heading">
      {image !== null ? (
        <PostImage
          image={image}
          sizes="(min-width: 1081px) 920px, 100vw"
          loading="lazy"
          className="aspect-[16/6] w-full object-cover"
        />
      ) : null}
      <div className="px-5 py-4 sm:px-6">
        <span className="rounded-[20px] bg-acbg px-[7px] py-px text-[10.5px] text-actx">
          مقاله ویژه
        </span>
        <h2 id="featured-post-heading" className="mt-2 text-[15.5px] leading-7 font-semibold">
          <a href={`/blog/${post.slug}`} className="transition-smooth hover:text-primary">
            {post.title_fa}
          </a>
        </h2>
        <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
          {postExcerpt(post.body_md)}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <a
            href={`/blog/${post.slug}`}
            className="transition-smooth text-[12.5px] font-medium text-primary hover:underline"
          >
            مطالعه مقاله ←
          </a>
          <time
            dateTime={post.published_at}
            className="text-[11px] whitespace-nowrap text-muted-foreground"
          >
            {formatDateFa(post.published_at)}
          </time>
        </div>
      </div>
    </section>
  );
}
