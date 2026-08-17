import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "../src/lib/admin-auth";
import { resetPriceSource, setPriceSource } from "../src/lib/prices";
import {
  buildReferralClickReport,
  getReferralClickReport,
  recordReferralClick,
  referralClickDay,
  referralClickDays,
  resetReferralClickSource,
  setReferralClickSource,
  type ReferralClickReport,
  type ReferralClickSource,
  type ReferralClicksByDay,
} from "../src/lib/referral-clicks";
import {
  adminReferralClicksGetResponse,
  adminReferralClicksMethodNotAllowed,
} from "../src/lib/server/admin-referral-clicks";
import { ADMIN_SESSION_COOKIE } from "../src/lib/server/admin-session";

const NOON_TEHRAN = Date.parse("2026-08-18T08:30:00.000Z");

interface Recorder {
  source: ReferralClickSource;
  writes: { slug: string; day: string }[];
  store: Record<string, Record<string, number>>;
}

function memorySource(): Recorder {
  const writes: { slug: string; day: string }[] = [];
  const store: Record<string, Record<string, number>> = {};
  return {
    writes,
    store,
    source: {
      async increment(slug, day) {
        writes.push({ slug, day });
        store[day] = { ...(store[day] ?? {}) };
        store[day]![slug] = (store[day]![slug] ?? 0) + 1;
      },
      async read(days) {
        const byDay: Record<string, Record<string, number>> = {};
        for (const day of days) byDay[day] = { ...(store[day] ?? {}) };
        return byDay;
      },
    },
  };
}

function brokenSource(error: Error): ReferralClickSource {
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
  resetReferralClickSource();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  resetReferralClickSource();
  vi.restoreAllMocks();
});

describe("day bucketing", () => {
  it("buckets by the Tehran day, not the UTC one", () => {
    expect(referralClickDay(Date.parse("2026-08-18T21:00:00.000Z"))).toBe("2026-08-19");
    expect(referralClickDay(Date.parse("2026-08-18T20:29:00.000Z"))).toBe("2026-08-18");
    expect(referralClickDay(Date.parse("2026-08-18T00:30:00.000Z"))).toBe("2026-08-18");
  });

  it("the window is oldest → newest and ends with today", () => {
    const days = referralClickDays(NOON_TEHRAN, 3);
    expect(days).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
  });
});

describe("counting", () => {
  it("each click increments today's bucket for that slug", async () => {
    const recorder = memorySource();
    setReferralClickSource(recorder.source);

    expect(await recordReferralClick("milli", NOON_TEHRAN)).toBe(true);
    expect(await recordReferralClick("milli", NOON_TEHRAN)).toBe(true);
    expect(await recordReferralClick("wallgold", NOON_TEHRAN)).toBe(true);

    expect(recorder.store["2026-08-18"]).toEqual({ milli: 2, wallgold: 1 });
  });

  it("clicks on different days land in different buckets", async () => {
    const recorder = memorySource();
    setReferralClickSource(recorder.source);

    await recordReferralClick("milli", NOON_TEHRAN - 86_400_000);
    await recordReferralClick("milli", NOON_TEHRAN);

    expect(recorder.store["2026-08-17"]).toEqual({ milli: 1 });
    expect(recorder.store["2026-08-18"]).toEqual({ milli: 1 });
  });

  it("the report totals the window, ranks by total and exposes today separately", async () => {
    const recorder = memorySource();
    setReferralClickSource(recorder.source);

    await recordReferralClick("wallgold", NOON_TEHRAN - 86_400_000);
    await recordReferralClick("milli", NOON_TEHRAN - 86_400_000);
    await recordReferralClick("milli", NOON_TEHRAN);
    await recordReferralClick("milli", NOON_TEHRAN);

    const report = await getReferralClickReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(true);
    expect(report.days).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
    expect(report.rows).toEqual([
      { slug: "milli", daily: [0, 1, 2], today: 2, total: 3 },
      { slug: "wallgold", daily: [0, 1, 0], today: 0, total: 1 },
    ]);
    expect(report.total).toBe(4);
  });

  it("a day outside the window is not counted in the report", async () => {
    const recorder = memorySource();
    setReferralClickSource(recorder.source);

    await recordReferralClick("milli", NOON_TEHRAN - 10 * 86_400_000);
    const report = await getReferralClickReport(NOON_TEHRAN, 3);
    expect(report.rows).toEqual([]);
    expect(report.total).toBe(0);
  });

  it("buildReferralClickReport ignores slugs that only appear outside the listed days", () => {
    const byDay: ReferralClicksByDay = {
      "2026-08-18": { milli: 4 },
      "2026-08-01": { wallgold: 99 },
    };
    const report = buildReferralClickReport(["2026-08-17", "2026-08-18"], byDay, true);
    expect(report.rows.map((row) => row.slug)).toEqual(["milli"]);
    expect(report.total).toBe(4);
  });
});

describe("staleness, not error", () => {
  it("with no source registered nothing throws and the report is marked unavailable", async () => {
    expect(await recordReferralClick("milli", NOON_TEHRAN)).toBe(false);
    const report = await getReferralClickReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.days).toHaveLength(3);
  });

  it("a store outage on write loses the click but never throws", async () => {
    setReferralClickSource(brokenSource(new Error("redis down")));
    await expect(recordReferralClick("milli", NOON_TEHRAN)).resolves.toBe(false);
  });

  it("a store outage on read yields an empty, unavailable report instead of an exception", async () => {
    setReferralClickSource(brokenSource(new Error("redis down")));
    const report = await getReferralClickReport(NOON_TEHRAN, 3);
    expect(report.available).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.total).toBe(0);
  });
});

describe("admin endpoint", () => {
  const SECRET = "test-session-secret";
  const REFERRAL_CODE = "MZN-SECRET-4242";

  function request(authed: boolean): Request {
    const token = createSessionToken(SECRET, Date.now());
    return new Request("https://tablo.gold/api/admin-referral-clicks", {
      method: "GET",
      ...(authed ? { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } } : {}),
    });
  }

  beforeEach(() => {
    vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
    setReferralClickSource(memorySource().source);
    setPriceSource({
      getListedPlatforms: async () => [
        {
          slug: "milli",
          name_fa: "میلی",
          data_policy: "ALLOWED",
          website_url: "https://milli.gold",
          referral_url: `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
        },
      ],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetPriceSource();
  });

  it("rejects an anonymous request", async () => {
    const response = await adminReferralClicksGetResponse(request(false));
    expect(response.status).toBe(401);
  });

  it("is noindex and never cached", async () => {
    const response = await adminReferralClicksGetResponse(request(true));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns per-slug rows with the platform's Persian name and no referral URL", async () => {
    const recorder = memorySource();
    setReferralClickSource(recorder.source);
    await recordReferralClick("milli");

    const response = await adminReferralClicksGetResponse(request(true));
    const body = (await response.json()) as {
      report: ReferralClickReport;
      names: Record<string, string>;
    };

    expect(body.names["milli"]).toBe("میلی");
    expect(body.report.rows.map((row) => row.slug)).toEqual(["milli"]);
    expect(body.report.total).toBe(1);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(REFERRAL_CODE);
    expect(serialized).not.toContain("referralCode");
    expect(serialized).not.toContain("http");
  });

  it("a store outage still answers 200 with an unavailable report", async () => {
    setReferralClickSource(brokenSource(new Error("redis down")));
    const response = await adminReferralClicksGetResponse(request(true));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { report: ReferralClickReport };
    expect(body.report.available).toBe(false);
    expect(body.report.rows).toEqual([]);
  });

  it("any other method is 405", () => {
    expect(adminReferralClicksMethodNotAllowed().status).toBe(405);
  });
});
