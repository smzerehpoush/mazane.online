import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { adminSecurityMiddleware } from "./lib/seo/admin-security";
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

// ⚠️ The mere presence of this file cancels the automatic CSRF install; if
// this middleware is removed, server functions stay unprotected against
// cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// ⚠️ Order is critical: `edgeCacheMiddleware` must stay outermost so its
// cache header also lands on errorMiddleware's 500 and the edge doesn't
// cache the error; and `adminSecurityMiddleware` immediately inside it, so
// the panel's no-store/noindex is set before the final cache decision.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    edgeCacheMiddleware,
    adminSecurityMiddleware,
    errorMiddleware,
    csrfMiddleware,
  ],
}));
