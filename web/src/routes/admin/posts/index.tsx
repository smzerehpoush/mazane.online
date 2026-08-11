/**
 * فهرست پست‌های بلاگ در پنل — ‎/admin/posts‎ (بلیت ۲۲).
 *
 * همه‌ی وضعیت‌ها (پیش‌نویس/منتشرشده/پس‌گرفته) با فیلتر ساده‌ی کلاینتی؛
 * منطق واقعی فهرست در `GET /api/admin-posts` (`lib/server/admin-posts-requests.ts`)
 * است — این فایل فقط UI.
 *
 * خط لوله‌ی خودکار محتوای پایتونی دست‌نخورده می‌ماند — این صفحه فقط همان
 * جدول `posts` را کنارش می‌خواند/می‌نویسد.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlogPost, PostStatus } from "@/lib/blog";
import { formatDateTimeFa } from "@/lib/format";

export const Route = createFileRoute("/admin/posts/")({
  head: () => ({
    meta: [
      { title: "پست‌ها — پنل مدیریت تابلو" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPostsIndexPage,
});

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  retracted: "پس‌گرفته‌شده",
};

const STATUS_BADGE_VARIANT: Record<PostStatus, "secondary" | "default" | "destructive"> = {
  draft: "secondary",
  published: "default",
  retracted: "destructive",
};

type Filter = "all" | PostStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "draft", label: "پیش‌نویس" },
  { value: "published", label: "منتشرشده" },
  { value: "retracted", label: "پس‌گرفته‌شده" },
];

function AdminPostsIndexPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/admin-posts");
        if (response.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!response.ok) {
          if (!cancelled) setLoadError("خواندن فهرست پست‌ها با خطا مواجه شد.");
          return;
        }
        const body = (await response.json()) as { posts: BlogPost[] };
        if (!cancelled) setPosts(body.posts);
      } catch {
        if (!cancelled) setLoadError("ارتباط با سرور برقرار نشد.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const filtered = useMemo(() => {
    if (posts === null) return null;
    const sorted = [...posts].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    if (filter === "all") return sorted;
    return sorted.filter((post) => post.status === filter);
  }, [posts, filter]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-background px-4 py-10">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>پست‌های بلاگ</CardTitle>
            <CardDescription>
              فهرست همه‌ی پست‌ها با هر وضعیتی — ساخت، ویرایش، انتشار و پس‌گیری.
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/admin/posts/new">+ پست تازه</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loadError !== null && <p className="text-sm text-destructive">{loadError}</p>}
          {posts === null && loadError === null && (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          )}
          {filtered !== null && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">پستی با این فیلتر نیست.</p>
          )}
          {filtered !== null && filtered.length > 0 && (
            <ul className="flex flex-col gap-2">
              {filtered.map((post) => (
                <li key={post.slug}>
                  <Link
                    to="/admin/posts/$slug"
                    params={{ slug: post.slug }}
                    className="flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-medium text-foreground">
                        {post.title_fa}
                      </span>
                      <span className="truncate text-xs text-muted-foreground" dir="ltr">
                        /blog/{post.slug}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[post.status]}>
                        {STATUS_LABEL[post.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeFa(post.updated_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
