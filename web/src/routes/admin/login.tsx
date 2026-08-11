/**
 * فرم ورود پنل مدیریت — ‎/admin/login‎ (بلیت ۲۰).
 *
 * فقط یک رمز عبور (بدون کاربر/نقش — تصمیم صریح مالک). موفقیت یعنی
 * `POST /api/admin-login` یک `Set-Cookie` نشست می‌دهد؛ این فایل فقط UI و
 * ناوبری بعد از آن است — منطق واقعی در `lib/server/admin-login.ts`.
 */
import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "ورود به پنل مدیریت" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.status === 204) {
        await navigate({ to: "/admin" });
        return;
      }
      if (response.status === 429) {
        setError("چند تلاش ناموفق پیاپی — چند دقیقه دیگر دوباره امتحان کنید.");
      } else {
        setError("رمز عبور اشتباه است.");
      }
    } catch {
      setError("مشکلی در ارتباط با سرور پیش آمد — دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ورود به پنل مدیریت</CardTitle>
          <CardDescription>تابلو</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">رمز عبور</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error !== null && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending || password.length === 0} className="w-full">
              {pending ? "در حال ورود…" : "ورود"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
