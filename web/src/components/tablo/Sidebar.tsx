/**
 * ستون کناری — تازه‌ترین نوشته‌های بلاگ از پستگرس (نو به کهنه).
 *
 * پستی نیست ⟸ این جزء اصلاً رندر نمی‌شود (تصمیم مالک: جعبه‌ی خالی نه)؛
 * تصمیمش در `routes/index.tsx` گرفته می‌شود تا جدول تمام‌عرض شود.
 * لینک‌ها داخلی‌اند (‎/blog/<slug>‎) — نه درآمدزا، پس rel نمی‌گیرند.
 */
import type { PublishedPost } from "@/lib/blog";
import { formatDateFa } from "@/lib/format";
import { postImageAsset } from "@/lib/images";

export function Sidebar({ posts }: { posts: PublishedPost[] }) {
  return (
    <aside className="glass-surface p-6 sm:p-7">
      <h2 className="text-sm font-semibold">تازه‌ترین نوشته‌ها</h2>
      <ul className="mt-5 space-y-5">
        {posts.map((post, index) => {
          // بلیت ۲۵: پستِ بدون عکس همان جعبه‌ی تزئینی امروز است — بدون جای خالی.
          const image = postImageAsset(post);
          return (
            <li
              key={post.slug}
              className="border-b border-border/60 pb-5 last:border-0 last:pb-0"
            >
              <a
                href={`/blog/${post.slug}`}
                className={`transition-smooth group flex items-center gap-4 hover:text-primary ${
                  index % 2 === 1 ? "flex-row-reverse" : ""
                }`}
              >
                {image !== null ? (
                  <img
                    src={image.url}
                    width={image.width}
                    height={image.height}
                    alt={image.alt}
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
                  <span className="block text-[13px] leading-6 font-medium">
                    {post.title_fa}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-muted-foreground">
                    <time dateTime={post.published_at}>
                      {formatDateFa(post.published_at)}
                    </time>
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
