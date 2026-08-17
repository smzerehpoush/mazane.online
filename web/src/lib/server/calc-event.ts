/**
 * ⚠️ Only `tool` and `event` are ever read out of the request body; every
 * other field is dropped before anything reaches the counter. A future
 * client that starts posting the visitor's weight or total must not be able
 * to make this endpoint store it — see the payload warning in
 * `lib/calc-events.ts`.
 */
import "@tanstack/react-start/server-only";

import { asCalcEvent, asCalcTool } from "../calc-events";
import { NO_STORE } from "../seo/cache-headers";
import { recordCalcEvent } from "./calc-event-counter";

const MAX_BODY_BYTES = 256;

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
}

function badRequest(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 400,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE },
  });
}

export async function calcEventResponse(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return badRequest("بدنه بیش از حد بزرگ است");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return badRequest("بدنه JSON معتبر نیست");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest("رویداد نامعتبر است");
  }

  const fields = body as { tool?: unknown; event?: unknown };
  const tool = asCalcTool(fields.tool);
  const event = asCalcEvent(fields.event);
  if (tool === null || event === null) return badRequest("رویداد نامعتبر است");

  try {
    await recordCalcEvent(tool, event);
  } catch (error) {
    console.error("calc-event: could not record event", error);
  }

  return noContent();
}

export function calcEventMethodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "فقط POST" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
      Allow: "POST",
    },
  });
}
