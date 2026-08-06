import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { edgeCacheMiddleware } from "./lib/seo/edge-cache";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// `edgeCacheMiddleware` عمداً **بیرونی‌ترین** است: باید هدر کش را روی پاسخ
// نهایی بنشاند، از جمله ۵۰۰ی که errorMiddleware می‌سازد (که باید no-store
// بگیرد تا لبه‌ی آروان خطا را کش نکند). جزئیات در lib/seo/cache-headers.ts.
export const startInstance = createStart(() => ({
  requestMiddleware: [edgeCacheMiddleware, errorMiddleware, csrfMiddleware],
}));
