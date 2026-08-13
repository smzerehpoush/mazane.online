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

import { SERVER_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";
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
 * ⚠️ این صفحه هرگز نباید جای «قیمت کهنه» را بگیرد: قطع منبع داده کهنگی است
 * نه خطا و در لایه‌ی داده به «داده‌ای نیست» ترجمه شده.
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
      { title: "تابلو — مقایسه‌ی قیمت واقعی طلا" },
      {
        name: "description",
        content: "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای ۱۸ عیار در سکوهای ایرانی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
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

/**
 * ⚠️ `suppressHydrationWarning` روی `<html>` اجباری است و بی‌ربط به سهل‌انگاری:
 * سرور همیشه `data-theme="light"` می‌نویسد و اسکریپت inline زیر، پیش از
 * رسیدن ری‌اکت، ممکن است `dark` کرده باشد. بدون این پرچم، ری‌اکت همان اختلاف
 * را خطای hydration گزارش می‌کند — درحالی‌که دقیقاً رفتار طراحی‌شده است
 * .
 * ⚠️ اسکریپت تم **باید** آخرین چیز داخل `<head>` و پیش از `<body>` باشد:
 * مرورگر آن را همان‌جا همگام اجرا می‌کند، پس صفت پیش از نقاشی اولین پیکسل
 * نشسته و فلش سفید رخ نمی‌دهد. جابه‌جا کردنش به انتهای بدنه یعنی برگشت فلش.
 * `dangerouslySetInnerHTML` تنها راه نوشتن اسکریپت درون‌خطی در ری‌اکت است؛
 * محتوایش ثابتِ کدنویسی‌شده است و هیچ ورودی کاربری در آن نیست.
 */
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-theme={SERVER_THEME} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
      <Outlet />
    </QueryClientProvider>
  );
}
