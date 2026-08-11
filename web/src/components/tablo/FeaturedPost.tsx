/**
 * کارت «مقاله ویژه» — انتهای ستون اصلی (بند ۳ و ۸ سند طراحی).
 *
 * ⚠️ **«ویژه» اینجا ادعای سردبیری نیست.** بک‌اند هیچ پرچم `is_featured` ای
 * ندارد (`docs/api-gaps.md` بند ۴)، پس تازه‌ترین پست منتشرشده انتخاب می‌شود.
 * برچسب کارت یک عنوان بخش است و متنش چیزی جز عنوان و چکیده‌ی خود پست ادعا
 * نمی‌کند — هیچ‌جا نمی‌گوید «بهترین» یا «پربازدیدترین».
 *
 * ⚠️ همین پست از فهرست ستون کناری کنار گذاشته می‌شود (`HomePage`)، وگرنه یک
 * نوشته دو بار در یک صفحه می‌آمد — هم بدمنظر است و هم محتوای تکراری در یک
 * سند.
 */
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";
import { postExcerpt } from "./home-view";

export function FeaturedPost({ post }: { post: PublishedPost }) {
  // بلیت ۲۵: پستِ بدون عکس همان کارت است، بدون جای خالی.
  const image = postImageAsset(post);
  return (
    <section className="card-surface overflow-hidden" aria-labelledby="featured-post-heading">
      {image !== null ? (
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          alt={image.alt}
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
