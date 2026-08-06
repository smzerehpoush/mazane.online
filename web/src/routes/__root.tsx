import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">۴۰۴</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">صفحه پیدا نشد</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          نشانی‌ای که خواستید وجود ندارد یا جابه‌جا شده است.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            بازگشت به صفحه‌ی اصلی
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * مرز خطای ریشه. فقط در لاگ سرور می‌نویسد — هیچ گزارش‌دهی به سرویس بیرونی
 * نیست (سایت به هیچ سرویس خارج از مرز وابسته نمی‌شود).
 *
 * ⚠️ این صفحه هرگز نباید جای «قیمت کهنه» را بگیرد: قطع منبع داده کهنگی است
 * نه خطا (قاعده‌ی ۵ قراردادها) و در لایه‌ی داده به «داده‌ای نیست» ترجمه شده.
 */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          این صفحه بالا نیامد
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          مشکلی از سمت ما پیش آمد. می‌توانید دوباره تلاش کنید یا به صفحه‌ی اصلی برگردید.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            تلاش دوباره
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            صفحه‌ی اصلی
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "مظنه آنلاین — مقایسه‌ی قیمت واقعی طلا" },
      { name: "description", content: "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای ۱۸ عیار در سکوهای ایرانی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // وزیرمتن خودمیزبان است (‎@font-face‎ در src/styles.css، فایل در
      // public/fonts). هیچ درخواستی به fonts.googleapis.com نمی‌رود — از
      // ایران کند یا مسدود است. preload چون فونت را مرورگر تازه بعد از
      // parse شدن CSS کشف می‌کند و این یک رفت‌وبرگشت به متن اضافه می‌کند.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/vazirmatn-variable-33.0.3.woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
