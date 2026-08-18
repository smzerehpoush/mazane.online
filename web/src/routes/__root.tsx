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

import { configuredImageOrigin, imagePreconnectLinks } from "@/lib/image-origin";
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
 * ⚠️ This page must never take the place of a "stale price": a data-source
 * outage is staleness, not error, and at the data layer it translates to
 * "no data".
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

/**
 * ⚠️ The image origin has to travel through the root loader; do **not** read
 * the environment inside `head()`. `head()` is evaluated on the client too,
 * where the variable does not exist — the link would then be present in the
 * server HTML and absent on hydration, and React answers that mismatch by
 * throwing the whole server render away and re-rendering on the client. The
 * loader's value is serialized with the page, so both sides agree.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => ({ imageOrigin: configuredImageOrigin() }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "تابلو — مقایسه‌ی قیمت واقعی طلا" },
      {
        name: "description",
        content: "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای ۱۸ عیار در سکوهای ایرانی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      ...imagePreconnectLinks(loaderData?.imageOrigin ?? null),
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
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * ⚠️ `suppressHydrationWarning` on `<html>` is mandatory and has nothing to
 * do with carelessness: the server always writes `data-theme="light"`, and
 * the inline script below may have already set `dark` before React arrives.
 * Without this flag, React reports that same mismatch as a hydration error —
 * even though it's exactly the intended behavior.
 * ⚠️ The theme script **must** be the last thing inside `<head>`, before
 * `<body>`: the browser runs it synchronously right there, so the attribute
 * is set before the first pixel is painted and no white flash occurs. Moving
 * it to the end of the body brings the flash back. `dangerouslySetInnerHTML`
 * is the only way to write an inline script in React; its content is
 * hardcoded and contains no user input.
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
