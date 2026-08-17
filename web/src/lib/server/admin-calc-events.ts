import "@tanstack/react-start/server-only";

import { CALC_EVENT_WINDOW_DAYS } from "../calc-events";
import { json, unauthorized } from "./admin-http";
import { getCalcEventReport } from "./calc-event-counter";
import { hasValidSession } from "./admin-session";

export async function adminCalcEventsGetResponse(request: Request): Promise<Response> {
  if (!hasValidSession(request.headers.get("cookie"))) return unauthorized();
  return json({ report: await getCalcEventReport(CALC_EVENT_WINDOW_DAYS) }, 200);
}

export function adminCalcEventsMethodNotAllowed(): Response {
  return json({ error: "فقط GET" }, 405, { Allow: "GET" });
}
