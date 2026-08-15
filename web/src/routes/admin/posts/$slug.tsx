/**
 * ⚠️ Deliberately no "delete image" button: the server has no route to
 * clear image_url — `POST /api/admin-posts/$slug/image` only uploads or
 * replaces, and every other method (including DELETE) is rejected with 405
 * (`adminPostImageMethodNotAllowed` in `lib/server/admin-post-image.ts`; the
 * text-update form also only accepts title_fa/body_md). A button that always
 * fails is worse than no button at all — this is a real gap, not an
 * oversight; actually deleting needs a separate ticket to add the server
 * route.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canUploadPostImage } from "@/lib/admin-post-image-form";
import type { BlogPost, PostStatus } from "@/lib/blog";
import { formatDateTimeFa } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

export const Route = createFileRoute("/admin/posts/$slug")({
  head: () => ({
    meta: [
      { title: "ویرایش پست — پنل مدیریت تابلو" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminEditPostPage,
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

function AdminEditPostPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [titleFa, setTitleFa] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [meaningfulEdit, setMeaningfulEdit] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageInputKey, setImageInputKey] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/admin-posts/${slug}`);
        if (response.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok) {
          if (!cancelled) setLoadError("خواندن پست با خطا مواجه شد.");
          return;
        }
        const body = (await response.json()) as { post: BlogPost };
        if (cancelled) return;
        setPost(body.post);
        setTitleFa(body.post.title_fa);
        setBodyMd(body.post.body_md);
      } catch {
        if (!cancelled) setLoadError("ارتباط با سرور برقرار نشد.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  const preview = useMemo(() => renderMarkdown(bodyMd || "*(پیش‌نمایش خالی)*"), [bodyMd]);

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/admin-posts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title_fa: titleFa, body_md: bodyMd, meaningfulEdit }),
      });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(body?.error ?? "ذخیره با خطا مواجه شد.");
        return;
      }
      const body = (await response.json()) as { post: BlogPost };
      setPost(body.post);
      setMeaningfulEdit(false);
      setSaved(true);
    } catch {
      setSaveError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!window.confirm("این پیش‌نویس منتشر شود؟")) return;
    setActing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin-posts/${slug}/publish`, { method: "POST" });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setActionError(body?.error ?? "انتشار با خطا مواجه شد.");
        return;
      }
      const body = (await response.json()) as { post: BlogPost };
      setPost(body.post);
    } catch {
      setActionError("ارتباط با سرور برقرار نشد.");
    } finally {
      setActing(false);
    }
  }

  async function onRetract() {
    if (!window.confirm("این پست پس گرفته شود؟ از فهرست عمومی و سایت‌مپ حذف می‌شود.")) return;
    setActing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin-posts/${slug}/retract`, { method: "POST" });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setActionError(body?.error ?? "پس‌گیری با خطا مواجه شد.");
        return;
      }
      const body = (await response.json()) as { post: BlogPost };
      setPost(body.post);
    } catch {
      setActionError("ارتباط با سرور برقرار نشد.");
    } finally {
      setActing(false);
    }
  }

  async function onUploadImage() {
    if (!canUploadPostImage({ file: imageFile, alt: imageAlt }) || imageFile === null) return;
    setImageUploading(true);
    setImageUploadError(null);
    setImageUploaded(false);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("alt", imageAlt);
      const response = await fetch(`/api/admin-posts/${slug}/image`, {
        method: "POST",
        body: formData,
      });
      if (response.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setImageUploadError(body?.error ?? "بارگذاری عکس با خطا مواجه شد.");
        return;
      }
      const body = (await response.json()) as { post: BlogPost };
      setPost(body.post);
      setImageFile(null);
      setImageAlt("");
      setImageInputKey((key) => key + 1);
      setImageUploaded(true);
    } catch {
      setImageUploadError("ارتباط با سرور برقرار نشد.");
    } finally {
      setImageUploading(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-background px-4 py-10">
        <p className="text-sm text-destructive">پستی با این اسلاگ پیدا نشد.</p>
        <Link to="/admin/posts" className="text-xs text-muted-foreground hover:text-foreground">
          ← بازگشت به فهرست پست‌ها
        </Link>
      </div>
    );
  }

  const canSave = titleFa.trim().length > 0 && bodyMd.trim().length > 0 && !saving;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-background px-4 py-10">
      <div>
        <Link to="/admin/posts" className="text-xs text-muted-foreground hover:text-foreground">
          ← بازگشت به فهرست پست‌ها
        </Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>ویرایش پست</CardTitle>
            <CardDescription dir="ltr">/blog/{slug}</CardDescription>
          </div>
          {post !== null && (
            <Badge variant={STATUS_BADGE_VARIANT[post.status]}>{STATUS_LABEL[post.status]}</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError !== null && <p className="text-sm text-destructive">{loadError}</p>}
          {post === null && loadError === null && (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          )}

          {post !== null && (
            <>
              <p className="text-xs text-muted-foreground">
                انتشار:{" "}
                {post.published_at !== null
                  ? formatDateTimeFa(post.published_at)
                  : "هنوز منتشر نشده"}
                {" — "}به‌روزرسانی: {formatDateTimeFa(post.updated_at)}
              </p>

              <div className="space-y-2">
                <Label htmlFor="post-title">عنوان</Label>
                <Input
                  id="post-title"
                  value={titleFa}
                  onChange={(event) => setTitleFa(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-body">متن (مارک‌داون)</Label>
                  <Textarea
                    id="post-body"
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

              <div className="space-y-3 border-t pt-4">
                <Label>عکس شاخص</Label>

                {post.image_url !== null && post.image_url !== undefined ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={post.image_url}
                      alt={post.image_alt ?? ""}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                    <p className="text-xs text-muted-foreground">
                      متن جایگزین فعلی:{" "}
                      {post.image_alt !== null && post.image_alt !== undefined
                        ? post.image_alt || "—"
                        : "—"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">این پست هنوز عکس شاخصی ندارد.</p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="post-image-file">
                      {post.image_url !== null && post.image_url !== undefined
                        ? "جایگزینی عکس"
                        : "بارگذاری عکس"}
                    </Label>
                    <Input
                      key={imageInputKey}
                      id="post-image-file"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        setImageFile(event.target.files?.[0] ?? null);
                        setImageUploaded(false);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-image-alt">متن جایگزین عکس (اجباری)</Label>
                    <Input
                      id="post-image-alt"
                      value={imageAlt}
                      onChange={(event) => {
                        setImageAlt(event.target.value);
                        setImageUploaded(false);
                      }}
                      placeholder="توصیف کوتاه عکس برای دسترس‌پذیری"
                    />
                  </div>
                </div>

                {imageUploadError !== null && (
                  <p className="text-sm text-destructive">{imageUploadError}</p>
                )}
                {imageUploaded && <p className="text-sm text-emerald-600">عکس بارگذاری شد.</p>}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onUploadImage()}
                  disabled={
                    !canUploadPostImage({ file: imageFile, alt: imageAlt }) || imageUploading
                  }
                >
                  {imageUploading ? "در حال بارگذاری…" : "بارگذاری عکس"}
                </Button>
              </div>

              {post.status === "published" && (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={meaningfulEdit}
                    onCheckedChange={(checked) => setMeaningfulEdit(checked === true)}
                  />
                  این ویرایش معنادار بود (تاریخ به‌روزرسانی سایت‌مپ را جلو می‌برد)
                </label>
              )}

              {saveError !== null && <p className="text-sm text-destructive">{saveError}</p>}
              {saved && <p className="text-sm text-emerald-600">ذخیره شد.</p>}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void onSave()} disabled={!canSave}>
                  {saving ? "در حال ذخیره…" : "ذخیره"}
                </Button>
                {post.status !== "published" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onPublish()}
                    disabled={acting}
                  >
                    {acting ? "…" : "انتشار"}
                  </Button>
                )}
                {post.status === "published" && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void onRetract()}
                    disabled={acting}
                  >
                    {acting ? "…" : "پس‌گیری"}
                  </Button>
                )}
              </div>
              {actionError !== null && <p className="text-sm text-destructive">{actionError}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
