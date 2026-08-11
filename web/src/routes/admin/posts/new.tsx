/**
 * ساخت پست تازه در پنل — ‎/admin/posts/new‎ (بلیت ۲۲).
 *
 * پست تازه همیشه `draft` ساخته می‌شود (منطق در `lib/admin-posts.ts::createPost`)
 * — انتشار یک قدم جدا در صفحه‌ی ویرایش است. پیش‌نمایش دقیقاً همان
 * `renderMarkdown` صفحه‌ی عمومی پست را صدا می‌زند تا هیچ رفتار متفاوتی بین
 * پیش‌نمایش و صفحه‌ی واقعی نباشد.
 */
import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlogPost } from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";

export const Route = createFileRoute("/admin/posts/new")({
  head: () => ({
    meta: [
      { title: "پست تازه — پنل مدیریت تابلو" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminNewPostPage,
});

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function AdminNewPostPage() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [titleFa, setTitleFa] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const slugLooksValid = slug.length === 0 || SLUG_PATTERN.test(slug);
  const preview = useMemo(() => renderMarkdown(bodyMd || "*(پیش‌نمایش خالی)*"), [bodyMd]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title_fa: titleFa, body_md: bodyMd }),
      });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "ساخت پست با خطا مواجه شد.");
        return;
      }
      const body = (await response.json()) as { post: BlogPost };
      await navigate({ to: "/admin/posts/$slug", params: { slug: body.post.slug } });
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    slug.length > 0 &&
    SLUG_PATTERN.test(slug) &&
    titleFa.trim().length > 0 &&
    bodyMd.trim().length > 0 &&
    !saving;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-background px-4 py-10">
      <div>
        <Link to="/admin/posts" className="text-xs text-muted-foreground hover:text-foreground">
          ← بازگشت به فهرست پست‌ها
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>پست تازه</CardTitle>
          <CardDescription>پست تازه همیشه به‌صورت پیش‌نویس ساخته می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="post-slug">اسلاگ</Label>
              <Input
                id="post-slug"
                dir="ltr"
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="hazine-panhan-tabdil"
              />
              {!slugLooksValid && (
                <p className="text-xs text-destructive">
                  فقط حروف لاتین کوچک، رقم و خط‌تیره‌ی میانی مجاز است (مثل «hazine-panhan»).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-title">عنوان</Label>
              <Input
                id="post-title"
                required
                value={titleFa}
                onChange={(event) => setTitleFa(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="post-body">متن (مارک‌داون)</Label>
                <Textarea
                  id="post-body"
                  required
                  rows={16}
                  value={bodyMd}
                  onChange={(event) => setBodyMd(event.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>پیش‌نمایش</Label>
                <div className="min-h-[16rem] space-y-3 rounded-md border p-4 text-sm leading-7">
                  {preview}
                </div>
              </div>
            </div>

            {error !== null && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={!canSubmit}>
              {saving ? "در حال ساخت…" : "ساخت پیش‌نویس"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
