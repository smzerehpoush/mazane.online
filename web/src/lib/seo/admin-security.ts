import { createMiddleware } from "@tanstack/react-start";

import { applyAdminHeaders } from "./admin-headers";

export const adminSecurityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  applyAdminHeaders(result.response, new URL(request.url).pathname);
  return result;
});
