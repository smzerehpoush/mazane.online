import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { JewelryCalculator } from "../src/components/tablo/JewelryCalculator";
import { createSessionToken } from "../src/lib/admin-auth";
import {
  asCalcEvent,
  asCalcTool,
  buildCalcEventReport,
  calcCompletionRate,
  calcEventBody,
  calcEventDay,
  calcEventDays,
  calcEventField,
  calcEventSessionKey,
  getCalcEventReport,
  isCalcCompleted,
  isCalcStarted,
  parseCalcEventField,
  recordCalcEvent,
  resetCalcEventSource,
  setCalcEventSource,
  type CalcEventReport,
  type CalcEventSource,
  CALC_COMPLETE_QUIET_MS,
  CALC_TOOL_JEWELRY,
  CALC_TOOL_NAMES_FA,
} from "../src/lib/calc-events";
import {
  adminCalcEventsGetResponse,
  adminCalcEventsMethodNotAllowed,
} from "../src/lib/server/admin-calc-events";
import { ADMIN_SESSION_COOKIE } from "../src/lib/server/admin-session";
import { calcEventMethodNotAllowed, calcEventResponse } from "../src/lib/server/calc-event";

const NOON_TEHRAN = Date.parse("2026-08-18T08:30:00.000Z");
const DAY_MS = 86_400_000;

const PREFILLED_VAT = "۱۰";

function initial(): Record<string, string> {
  return { weight: "", wage: "", profit: "", vat: PREFILLED_VAT };
}

interface Recorder {
  source: CalcEventSource;
  writes: { field: string; day: string }[];
  store: Record<string, Record<string, number>>;
}

function memorySource(): Recorder {
  const writes: { field: string; day: string }[] = [];
  const store: Record<string, Record<string, number>> = {};
  return {
    writes,
    store,
    source: {
      async increment(field, day) {
        writes.push({ field, day });
        store[day] = { ...(store[day] ?? {}) };
        store[day]![field] = (store[day]![field] ?? 0) + 1;
      },
      async read(days) {
        const byDay: Record<string, Record<string, number>> = {};
        for (const day of days) byDay[day] = { ...(store[day] ?? {}) };
        return byDay;
      },
    },
  };
}

function brokenSource(error: Error): CalcEventSource {
  return {
    async increment() {
      throw error;
    },
    async read() {
      throw error;
    },
  };
}

beforeEach(() => {
  resetCalcEventSource();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  resetCalcEventSource();
  vi.restoreAllMocks();
});

describe("what counts as a calc_start", () => {
  it("an untouched calculator is not a start — mounting the page is a page view, not a calculation", () => {
    expect(isCalcStarted(initial(), initial())).toBe(false);
  });

  it("the statutory VAT rate arriving pre-filled is not an edit by the user", () => {
    expect(isCalcStarted(initial(), { ...initial(), vat: PREFILLED_VAT })).toBe(false);
  });

  it("the first character typed into any input is a start", () => {
    expect(isCalcStarted(initial(), { ...initial(), weight: "۲" })).toBe(true);
    expect(isCalcStarted(initial(), { ...initial(), wage: "۷" })).toBe(true);
    expect(isCalcStarted(initial(), { ...initial(), profit: "۵" })).toBe(true);
  });

  it("overriding the pre-filled VAT is a start, and so is clearing it", () => {
    expect(isCalcStarted(initial(), { ...initial(), vat: "۹" })).toBe(true);
    expect(isCalcStarted(initial(), { ...initial(), vat: "" })).toBe(true);
  });

  it("a start is intent, not validity — an unparseable weight still counts", () => {
    expect(isCalcStarted(initial(), { ...initial(), weight: "دو گرم" })).toBe(true);
  });

  it("typing and then deleting everything is back to not-started", () => {
    expect(isCalcStarted(initial(), { ...initial(), weight: "" })).toBe(false);
  });
});

describe("what counts as a calc_complete", () => {
  const filled = { weight: "۲٫۵", wage: "۱۸", profit: "", vat: PREFILLED_VAT };

  it("required inputs parsed and a number on screen ⟸ complete", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, filled, true)).toBe(true);
  });

  it("weight alone is a gold-price lookup, not a jewelry decision ⟸ not complete", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, { ...initial(), weight: "۲٫۵" }, true)).toBe(false);
  });

  it("wage alone, with no weight, is not complete", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, { ...initial(), wage: "۱۸" }, true)).toBe(false);
  });

  it("no result on screen (the reference price is unavailable) ⟸ not complete", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, filled, false)).toBe(false);
  });

  it("an unparseable required input ⟸ not complete", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, { ...filled, wage: "هجده" }, true)).toBe(false);
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, { ...filled, weight: "۰" }, true)).toBe(false);
  });

  it("profit and VAT are not required — a piece with no stated profit still completes", () => {
    expect(isCalcCompleted(CALC_TOOL_JEWELRY, { ...filled, profit: "", vat: "" }, true)).toBe(true);
  });

  it("Latin digits are accepted exactly like Persian ones", () => {
    expect(
      isCalcCompleted(
        CALC_TOOL_JEWELRY,
        { weight: "2.5", wage: "18", profit: "", vat: "10" },
        true,
      ),
    ).toBe(true);
  });

  it("the quiet window is long enough that a two-digit weight is not counted at its first digit", () => {
    expect(CALC_COMPLETE_QUIET_MS).toBeGreaterThanOrEqual(1000);
  });
});

describe("the key shape", () => {
  it("a field is <tool>:<event>, so a new tool is a new field and needs no migration", () => {
    expect(calcEventField(CALC_TOOL_JEWELRY, "calc_start")).toBe("jewelry:calc_start");
    expect(calcEventField(CALC_TOOL_JEWELRY, "calc_complete")).toBe("jewelry:calc_complete");
    expect(calcEventField("sekeh-calculator", "calc_start")).toBe("sekeh-calculator:calc_start");
  });

  it("a field round-trips back to its tool and event", () => {
    expect(parseCalcEventField("jewelry:calc_complete")).toEqual({
      tool: "jewelry",
      event: "calc_complete",
    });
    expect(parseCalcEventField("gold-18k-tool:calc_start")).toEqual({
      tool: "gold-18k-tool",
      event: "calc_start",
    });
  });

  it("garbage fields are dropped rather than becoming a phantom tool", () => {
    expect(parseCalcEventField("jewelry")).toBeNull();
    expect(parseCalcEventField("jewelry:something-else")).toBeNull();
    expect(parseCalcEventField(":calc_start")).toBeNull();
  });

  it("the write path only accepts a registered tool and a known event", () => {
    expect(asCalcTool("jewelry")).toBe("jewelry");
    expect(asCalcTool("not-a-tool")).toBeNull();
    expect(asCalcTool(42)).toBeNull();
    expect(asCalcEvent("calc_start")).toBe("calc_start");
    expect(asCalcEvent("calc_finish")).toBeNull();
  });

  it("the session key is per tool and per event, so one does not suppress the other", () => {
    expect(calcEventSessionKey(CALC_TOOL_JEWELRY, "calc_start")).toBe(
      "tablo:calc:jewelry:calc_start",
    );
    expect(calcEventSessionKey(CALC_TOOL_JEWELRY, "calc_start")).not.toBe(
      calcEventSessionKey(CALC_TOOL_JEWELRY, "calc_complete"),
    );
  });

  it("the tool has a Persian name for the admin table", () => {
    expect(CALC_TOOL_NAMES_FA[CALC_TOOL_JEWELRY]).toContain("زینتی");
  });
});

describe("day bucketing", () => {
  it("buckets by the Tehran day, not the UTC one", () => {
    expect(calcEventDay(Date.parse("2026-08-18T21:00:00.000Z"))).toBe("2026-08-19");
    expect(calcEventDay(Date.parse("2026-08-18T20:29:00.000Z"))).toBe("2026-08-18");
  });

  it("the window is oldest → newest and ends with today", () => {
    expect(calcEventDays(NOON_TEHRAN, 3)).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
  });
});

describe("counting", () => {
  it("start and complete land in separate fields of the same day bucket", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    expect(await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN)).toBe(true);
    expect(await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN)).toBe(true);
    expect(await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_complete", NOON_TEHRAN)).toBe(true);

    expect(recorder.store["2026-08-18"]).toEqual({
      "jewelry:calc_start": 2,
      "jewelry:calc_complete": 1,
    });
  });

  it("events on different days land in different buckets", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN - DAY_MS);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN);

    expect(recorder.store["2026-08-17"]).toEqual({ "jewelry:calc_start": 1 });
    expect(recorder.store["2026-08-18"]).toEqual({ "jewelry:calc_start": 1 });
  });

  it("the report keeps the two series apart and exposes today separately", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN - DAY_MS);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_complete", NOON_TEHRAN);

    const report = await getCalcEventReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(true);
    expect(report.days).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
    expect(report.rows).toEqual([
      {
        tool: "jewelry",
        starts: [0, 1, 2],
        completes: [0, 0, 1],
        startsToday: 2,
        completesToday: 1,
        startsTotal: 3,
        completesTotal: 1,
      },
    ]);
    expect(report.startsTotal).toBe(3);
    expect(report.completesTotal).toBe(1);
  });

  it("a day outside the window is not counted", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN - 10 * DAY_MS);
    const report = await getCalcEventReport(NOON_TEHRAN, 3);
    expect(report.rows).toEqual([]);
    expect(report.startsTotal).toBe(0);
  });

  it("a tool that the current build no longer lists still reports its history", () => {
    const report = buildCalcEventReport(
      ["2026-08-18"],
      { "2026-08-18": { "retired-tool:calc_start": 5, "retired-tool:calc_complete": 2 } },
      true,
    );
    expect(report.rows.map((row) => row.tool)).toEqual(["retired-tool"]);
    expect(report.completesTotal).toBe(2);
  });

  it("rows rank by completes, the metric that matters", () => {
    const report = buildCalcEventReport(
      ["2026-08-18"],
      {
        "2026-08-18": {
          "alef:calc_start": 900,
          "alef:calc_complete": 1,
          "be:calc_start": 10,
          "be:calc_complete": 9,
        },
      },
      true,
    );
    expect(report.rows.map((row) => row.tool)).toEqual(["be", "alef"]);
  });

  it("the completion rate is completes over starts, and undefined without any start", () => {
    const report = buildCalcEventReport(
      ["2026-08-18"],
      { "2026-08-18": { "alef:calc_start": 4, "alef:calc_complete": 1, "be:calc_complete": 3 } },
      true,
    );
    const alef = report.rows.find((row) => row.tool === "alef");
    const be = report.rows.find((row) => row.tool === "be");
    expect(alef && calcCompletionRate(alef)).toBe(0.25);
    expect(be && calcCompletionRate(be)).toBeNull();
  });
});

describe("staleness, not error", () => {
  it("with no source registered nothing throws and the report is marked unavailable", async () => {
    expect(await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start", NOON_TEHRAN)).toBe(false);
    const report = await getCalcEventReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.days).toHaveLength(3);
  });

  it("a store outage on write loses the event but never throws", async () => {
    setCalcEventSource(brokenSource(new Error("redis down")));
    await expect(recordCalcEvent(CALC_TOOL_JEWELRY, "calc_complete", NOON_TEHRAN)).resolves.toBe(
      false,
    );
  });

  it("a store outage on read yields an empty, unavailable report instead of an exception", async () => {
    setCalcEventSource(brokenSource(new Error("redis down")));
    const report = await getCalcEventReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.completesTotal).toBe(0);
  });
});

describe("POST /api/calc-event", () => {
  function request(body: unknown, method = "POST"): Request {
    return new Request("https://tablo.gold/api/calc-event", {
      method,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("a valid start is 204, never cached, and increments its own field", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    const response = await calcEventResponse(request({ tool: "jewelry", event: "calc_start" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(recorder.writes.map((write) => write.field)).toEqual(["jewelry:calc_start"]);
  });

  it("a valid complete is counted separately from a start", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    await calcEventResponse(request({ tool: "jewelry", event: "calc_start" }));
    await calcEventResponse(request({ tool: "jewelry", event: "calc_complete" }));

    expect(recorder.writes.map((write) => write.field)).toEqual([
      "jewelry:calc_start",
      "jewelry:calc_complete",
    ]);
  });

  it("an unregistered tool is rejected and mints no field", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    const response = await calcEventResponse(
      request({ tool: "../../etc/passwd", event: "calc_start" }),
    );

    expect(response.status).toBe(400);
    expect(recorder.writes).toEqual([]);
    expect(recorder.store).toEqual({});
  });

  it("an unknown event name is rejected", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    expect((await calcEventResponse(request({ tool: "jewelry", event: "calc_peek" }))).status).toBe(
      400,
    );
    expect((await calcEventResponse(request({ tool: "jewelry" }))).status).toBe(400);
    expect(recorder.writes).toEqual([]);
  });

  it("malformed, non-object and oversized bodies are rejected without being counted", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    expect((await calcEventResponse(request("{ نه JSON"))).status).toBe(400);
    expect((await calcEventResponse(request("null"))).status).toBe(400);
    expect((await calcEventResponse(request(["jewelry", "calc_start"]))).status).toBe(400);
    expect(
      (
        await calcEventResponse(
          request({ tool: "jewelry", event: "calc_start", pad: "x".repeat(500) }),
        )
      ).status,
    ).toBe(400);
    expect(recorder.writes).toEqual([]);
  });

  it("a different method ⟸ 405 with an Allow header", () => {
    const response = calcEventMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("counter outage ⟸ still 204, the calculator never sees an error", async () => {
    setCalcEventSource(brokenSource(new Error("redis down")));
    const response = await calcEventResponse(request({ tool: "jewelry", event: "calc_complete" }));
    expect(response.status).toBe(204);
  });
});

describe("no personal data reaches the store", () => {
  it("the beacon payload is exactly the tool and the event", () => {
    const body = calcEventBody(CALC_TOOL_JEWELRY, "calc_complete");
    expect(Object.keys(body).sort()).toEqual(["event", "tool"]);
    expect(JSON.stringify(body)).toBe('{"tool":"jewelry","event":"calc_complete"}');
  });

  it("amounts smuggled into the request body are dropped — only a count is stored", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);

    const response = await calcEventResponse(
      new Request("https://tablo.gold/api/calc-event", {
        method: "POST",
        body: JSON.stringify({
          tool: "jewelry",
          event: "calc_complete",
          weight: "2.5",
          total: 65620000,
        }),
      }),
    );

    expect(response.status).toBe(204);
    const serialized = JSON.stringify(recorder.store);
    expect(recorder.store[calcEventDay(Date.now())]).toEqual({ "jewelry:calc_complete": 1 });
    expect(serialized).not.toContain("2.5");
    expect(serialized).not.toContain("65620000");
    expect(serialized).not.toContain("weight");
    expect(serialized).not.toContain("total");
  });

  it("the report exposes counts and days only, never an input", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_complete", NOON_TEHRAN);

    const report = await getCalcEventReport(NOON_TEHRAN, 3);
    const row = report.rows[0];
    expect(row).toBeDefined();
    expect(Object.keys(row!).sort()).toEqual([
      "completes",
      "completesToday",
      "completesTotal",
      "starts",
      "startsToday",
      "startsTotal",
      "tool",
    ]);
  });
});

describe("admin endpoint", () => {
  const SECRET = "test-session-secret";

  function request(authed: boolean): Request {
    const token = createSessionToken(SECRET, Date.now());
    return new Request("https://tablo.gold/api/admin-calc-events", {
      method: "GET",
      ...(authed ? { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } } : {}),
    });
  }

  beforeEach(() => {
    vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
    setCalcEventSource(memorySource().source);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects an anonymous request", async () => {
    expect((await adminCalcEventsGetResponse(request(false))).status).toBe(401);
  });

  it("is noindex and never cached", async () => {
    const response = await adminCalcEventsGetResponse(request(true));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns the per-tool rows recorded today", async () => {
    const recorder = memorySource();
    setCalcEventSource(recorder.source);
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_start");
    await recordCalcEvent(CALC_TOOL_JEWELRY, "calc_complete");

    const response = await adminCalcEventsGetResponse(request(true));
    const body = (await response.json()) as { report: CalcEventReport };

    expect(body.report.rows.map((row) => row.tool)).toEqual(["jewelry"]);
    expect(body.report.startsTotal).toBe(1);
    expect(body.report.completesTotal).toBe(1);
  });

  it("a store outage still answers 200 with an unavailable report", async () => {
    setCalcEventSource(brokenSource(new Error("redis down")));
    const response = await adminCalcEventsGetResponse(request(true));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { report: CalcEventReport };
    expect(body.report.available).toBe(false);
    expect(body.report.rows).toEqual([]);
  });

  it("any other method is 405", () => {
    expect(adminCalcEventsMethodNotAllowed().status).toBe(405);
  });
});

describe("the calculator itself is untouched by the beacon", () => {
  it("rendering it on the server sends nothing — the beacon only exists in the browser", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={18_500_000} referenceName="میلی" />,
    );

    expect(html).toContain("ماشین حساب طلای زینتی");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("it still renders without a reference price, so no result means no complete", () => {
    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={null} referenceName={null} />,
    );
    expect(html).toContain("data-calculator-total");
    expect(html).toContain("—");
  });
});
