/**
 * ⚠️ `admin/login.tsx` هم زیر همین لایوت است (همان دایرکتوری) — بدون
 * استثنا برای مسیر خودِ لاگین، بررسی نشست هر بار او را هم دوباره به خودش
 * ریدایرکت می‌کرد (حلقه‌ی بی‌پایان). به همین دلیل مسیر ورود صریح رد می‌شود.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { checkAdminSession } from "@/lib/admin-guard";

const LOGIN_PATH = "/admin/login";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === LOGIN_PATH) return;
    const authenticated = await checkAdminSession();
    if (!authenticated) throw redirect({ to: LOGIN_PATH });
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => <Outlet />,
});
