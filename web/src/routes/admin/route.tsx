/**
 * لایوت بی‌مسیر پنل مدیریت — ‎/admin‎ (بلیت ۲۰).
 *
 * `beforeLoad` نشست را می‌سنجد (از طریق `checkAdminSession`، تابع سروری
 * `lib/admin-guard.ts`) و بدون نشست معتبر به `/admin/login` می‌فرستد.
 * طبق مستندات react-start این فقط برای «تجربه‌ی ناوبری» است — دروازه‌ی
 * واقعی همان تابع سروری است که کوکی را در context درخواست واقعی می‌خواند؛
 * اینجا صرفاً UX ناوبری کلاینت را زودتر درست می‌کند.
 *
 * ⚠️ `admin/login.tsx` هم زیر همین لایوت است (همان دایرکتوری) — بدون
 * استثنا برای مسیر خودِ لاگین، بررسی نشست هر بار او را هم دوباره به خودش
 * ریدایرکت می‌کرد (حلقه‌ی بی‌پایان). به همین دلیل مسیر ورود صریح رد می‌شود.
 *
 * سرصفحه: متای ‎noindex, nofollow‎ روی هر مسیر پنل هم گذاشته می‌شود — لایه‌ی
 * دوم دفاعی؛ هدر واقعی HTTP (که خزنده/کش واقعاً می‌بینند) از
 * `adminSecurityMiddleware` سراسری می‌آید (`lib/seo/admin-security.ts`)
 * چون در react-start راهی برای هدر HTTP واقعی روی یک page route (نه فقط
 * `<meta>`) پیدا نشد.
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
