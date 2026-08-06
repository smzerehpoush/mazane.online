/**
 * صفحه‌ی خالی «خوش آمدید» پنل مدیریت — ‎/admin‎ (بلیت ۲۰).
 *
 * این تیکت فقط «در» پنل را می‌سازد — هیچ قابلیت مدیریتی (سکوهای نمودار،
 * لینک معرف، ویرایش پست) هنوز اینجا نیست. فقط تأیید ورود + دکمه‌ی خروج.
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "پنل مدیریت — مظنه آنلاین" }, { name: "robots", content: "noindex, nofollow" }],
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
      <Button variant="outline" onClick={() => void onLogout()} disabled={pending}>
        {pending ? "در حال خروج…" : "خروج"}
      </Button>
    </div>
  );
}
