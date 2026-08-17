import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "پنل مدیریت — تابلو" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminHomePage,
});

function AdminHomePage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await fetch("/api/admin-logout", { method: "POST" });
    } finally {
      await navigate({ to: "/admin/login" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <h1 className="text-2xl font-semibold text-foreground">خوش آمدید</h1>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="secondary">
          <Link to="/admin/posts">پست‌های بلاگ</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/admin/platforms">تنظیمات نمودار</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/admin/clicks">آمار</Link>
        </Button>
      </div>
      <Button variant="outline" onClick={() => void onLogout()} disabled={pending}>
        {pending ? "در حال خروج…" : "خروج"}
      </Button>
    </div>
  );
}
