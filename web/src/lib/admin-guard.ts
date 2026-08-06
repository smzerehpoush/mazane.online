/**
 * تنها راه ورود لایوت `/admin` به بررسی نشست — سیم‌کشی نازک، دقیقاً مثل
 * `home-data.ts`: بدنه‌ی `handler` را کامپایلر Start به ماژول سمت‌سروری جدا
 * می‌برد و کلاینت فقط یک RPC می‌بیند، پس `admin-session.ts` (و در نتیجه
 * `node:crypto`، `MAZANE_ADMIN_SESSION_SECRET`) هرگز به باندل مرورگر نمی‌رود.
 *
 * ⚠️ چرا این فایل بیرون از `src/lib/server/` است: پلاگین import-protection
 * تنکستک هر مسیری با پوشه‌ی `server/` را از گراف کلاینت رد می‌کند، و این
 * فایل باید از `routes/admin/route.tsx` (که در گراف کلاینت است) import شود.
 *
 * مصرف‌کننده‌ی این تابع (`beforeLoad` لایوت `/admin`) طبق مستندات
 * react-start فقط برای «تجربه‌ی ناوبری» است — دروازه‌ی واقعی امنیت همین
 * تابع سروری است که `getRequestHeader("cookie")` را در context درخواست
 * واقعی می‌خواند، نه یک بررسی سمت کلاینت.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { hasValidSession } from "./server/admin-session";

export const checkAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => hasValidSession(getRequestHeader("cookie") ?? null),
);
