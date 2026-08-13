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
