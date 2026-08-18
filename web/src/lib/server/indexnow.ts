import "@tanstack/react-start/server-only";

import { INDEXNOW_ENDPOINT, buildIndexNowPayload } from "../seo/indexnow";

export type IndexNowOutcome = "skipped" | "submitted" | "failed";

const DEFAULT_TIMEOUT_MS = 3000;

export interface SubmitOptions {
  key?: string | undefined;
  siteUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function submitToIndexNow(
  paths: readonly string[],
  options: SubmitOptions = {},
): Promise<IndexNowOutcome> {
  const key = options.key ?? process.env["TABLO_INDEXNOW_KEY"];
  const payload = buildIndexNowPayload(paths, {
    key,
    ...(options.siteUrl === undefined ? {} : { siteUrl: options.siteUrl }),
  });
  if (payload === null) return "skipped";

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(
        `IndexNow rejected the submission with ${response.status} — publishing is unaffected`,
      );
      return "failed";
    }
    return "submitted";
  } catch (error) {
    console.error("IndexNow submission failed — publishing is unaffected", error);
    return "failed";
  }
}
