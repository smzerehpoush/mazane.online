/**
 * کارت‌های نوشته در انتهای صفحه.
 *
 * ⚠️ عنوان طرح اولیه «پرخواننده‌ترین نوشته‌ها» بود، ولی هنوز هیچ شمارنده‌ی
 * بازدیدی نداریم. عدد بازدید جعل نمی‌کنیم و ادعای «پرخواننده‌ترین» هم بدون
 * داده جعلِ ادعاست — پس ترتیب همان تاریخ انتشار است و عنوان خنثی. روزی که
 * شمارنده آمد، فقط همین دو چیز عوض می‌شوند.
 */
import type { PublishedPost } from "@/lib/blog";
import { postExcerpt } from "./home-view";
import { formatDateFa } from "@/lib/format";

export function PopularPosts({ posts }: { posts: PublishedPost[] }) {
  return (
    <section aria-labelledby="more-posts-heading">
      <h2 id="more-posts-heading" className="text-base font-semibold sm:text-lg">
        بیشتر بخوانید
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article key={post.slug} className="glass-surface lift-hover flex flex-col p-5">
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
        ))}
      </div>
    </section>
  );
}
