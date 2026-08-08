/**
 * کارت‌های نوشته در انتهای صفحه.
 *
 * عنوان **تابع داده** است، نه ثابت: تا وقتی هیچ بازدیدی ثبت نشده،
 * «بیشتر بخوانید» می‌ماند و ترتیب تاریخ است — چون «پرخواننده‌ترین» بدون
 * داده، ادعای جعلی است. با آمدن نخستین بازدید، عنوان و ترتیب هر دو عوض
 * می‌شوند (`byPopularity` در `lib/views.ts`).
 *
 * عدد بازدید هرگز نمایش داده نمی‌شود — تخمینی است (فیلتر مکث و نشست تب) و
 * انتشار یک تخمین به‌عنوان آمار دقیق، همان جعل عدد است.
 */
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
      <h2 id="more-posts-heading" className="text-base font-semibold sm:text-lg">
        {rankedByViews ? "پرخواننده‌ترین نوشته‌ها" : "بیشتر بخوانید"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          // بلیت ۲۵: پستِ بدون عکس همان کارت امروز است — بدون هیچ جای خالی.
          const image = postImageAsset(post);
          return (
            <article key={post.slug} className="glass-surface lift-hover flex flex-col p-5">
              {image !== null ? (
                <img
                  src={image.url}
                  width={image.width}
                  height={image.height}
                  alt={image.alt}
                  loading="lazy"
                  className="mb-4 aspect-video w-full rounded-xl object-cover"
                />
              ) : null}
              <h3 className="text-sm leading-7 font-semibold">
                <a href={`/blog/${post.slug}`} className="transition-smooth hover:text-primary">
                  {post.title_fa}
                </a>
              </h3>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                {postExcerpt(post.body_md)}
              </p>
              <div className="mt-4 text-[11px] text-muted-foreground">
                <time dateTime={post.published_at}>{formatDateFa(post.published_at)}</time>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
