/**
 * میان‌افزار درخواست که سیاست کش لبه را روی **همه‌ی** پاسخ‌ها می‌نشاند.
 *
 * چرا میان‌افزار سراسری و نه گزینه‌ی `headers` هر مسیر: هدر ‎stale-if-error‎
 * پیش‌شرط سختِ سئوست (بند ۱۰ سند معماری) و نباید به یادآوری هر عاملی که
 * صفحه‌ی تازه‌ای اضافه می‌کند وابسته باشد. یک نقطه، یک قاعده، بدون فراموشی.
 *
 * تصمیم واقعی در `cache-headers.ts` است (خالص و تست‌پذیر)؛ اینجا فقط سیم‌کشی
 * به تنکستک است. ثبتش در `src/start.ts` انجام می‌شود.
 */
import { createMiddleware } from "@tanstack/react-start";

import { applyEdgeCacheControl } from "./cache-headers";

export const edgeCacheMiddleware = createMiddleware().server(
  async ({ next, request, handlerType }) => {
    const result = await next();
    applyEdgeCacheControl(result.response, {
      pathname: new URL(request.url).pathname,
      isServerFn: handlerType === "serverFn",
    });
    return result;
  },
);
