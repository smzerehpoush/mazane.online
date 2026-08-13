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

// ⚠️ وجود همین فایل، نصب خودکار CSRF را لغو می‌کند؛ اگر این میان‌افزار برداشته
// شود، توابع سرور بی‌محافظ در برابر درخواست‌های cross-site می‌مانند.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// ⚠️ ترتیب حیاتی است: `edgeCacheMiddleware` باید بیرونی‌ترین بماند تا هدر کش
// روی ۵۰۰ی errorMiddleware هم بنشیند و لبه خطا را کش نکند؛ و
// `adminSecurityMiddleware` بلافاصله داخل آن، تا no-store/noindex پنل پیش از
// تصمیم نهایی کش گذاشته شود.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    edgeCacheMiddleware,
    adminSecurityMiddleware,
    errorMiddleware,
    csrfMiddleware,
  ],
}));
