/**
 * ⚠️ `admin/login.tsx` is also under this same layout (same directory) —
 * without an exception for the login route itself, the session check would
 * redirect it back to itself every time (infinite loop). That's why the
 * login route is explicitly skipped.
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
