import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { hasValidSession } from "./server/admin-session";

// ⚠️ دروازه‌ی واقعی امنیت همین تابع سروری است؛ بررسی `beforeLoad` سمت کلاینت
// فقط برای تجربه‌ی ناوبری است و نباید جایگزین آن شود.
export const checkAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => hasValidSession(getRequestHeader("cookie") ?? null),
);
