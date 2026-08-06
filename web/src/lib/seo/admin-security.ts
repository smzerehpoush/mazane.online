/**
 * میان‌افزار درخواست که هدرهای بی‌کش/بدون‌نمایه‌ی پنل مدیریت را روی
 * **همه‌ی** پاسخ‌های زیر ‎/admin‎ می‌نشاند — چه صفحه باشد چه هر پاسخ دیگری
 * که از این مسیر می‌گذرد (شامل ۵۰۰ی که `errorMiddleware` می‌سازد).
 *
 * تصمیم واقعی در `admin-headers.ts` است (خالص و تست‌پذیر)؛ اینجا فقط
 * سیم‌کشی به تنکستک است. ثبتش در `src/start.ts` انجام می‌شود — **داخل**
 * `edgeCacheMiddleware` (نه بیرونش)، تا وقتی این میان‌افزار `Cache-Control`
 * را زودتر می‌گذارد، `edgeCacheMiddleware` (که آخرین بار پاسخ نهایی را
 * می‌بیند) طبق قاعده‌ی «پاسخی که خودش Cache-Control گذاشته دست‌نخورده
 * می‌ماند» آن را override نکند.
 */
import { createMiddleware } from "@tanstack/react-start";

import { applyAdminHeaders } from "./admin-headers";

export const adminSecurityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  applyAdminHeaders(result.response, new URL(request.url).pathname);
  return result;
});
