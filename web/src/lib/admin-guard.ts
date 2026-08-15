import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { hasValidSession } from "./server/admin-session";

// ⚠️ The real security gate is this server function; the client-side
// `beforeLoad` check is only for navigation UX and must not replace it.
export const checkAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => hasValidSession(getRequestHeader("cookie") ?? null),
);
