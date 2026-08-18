import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "../src/lib/admin-auth";
import {
  emptyProfile,
  resetPlatformProfilesSource,
  setPlatformProfilesSource,
  type PlatformProfileEntry,
  type PlatformProfilesSource,
} from "../src/lib/platform-profile";
import {
  resetPlatformSettingsSource,
  setPlatformSettingsSource,
  type PlatformOption,
  type PlatformSettingEntry,
  type PlatformSettingsSource,
} from "../src/lib/platform-settings";
import {
  adminPlatformSettingsGetResponse,
  adminPlatformSettingsMethodNotAllowed,
  adminPlatformSettingsPostResponse,
} from "../src/lib/server/admin-platform-settings";
import { ADMIN_SESSION_COOKIE } from "../src/lib/server/admin-session";

const SECRET = "test-session-secret";
const REFERRAL_CODE = "MZN-SECRET-4242";

const PLATFORMS: PlatformOption[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", website_url: "https://wallgold.ir" },
  { slug: "talasea", name_fa: "طلاسی", website_url: "https://talasea.ir" },
  { slug: "milli", name_fa: "میلی", website_url: "https://milli.gold" },
  { slug: "tlyn", name_fa: "طلاین", website_url: "https://taline.ir" },
];

class FakeSource implements PlatformSettingsSource {
  settings: PlatformSettingEntry[];
  written: PlatformSettingEntry[] | null = null;

  constructor(initial: PlatformSettingEntry[] = []) {
    this.settings = initial;
  }

  async listPlatforms(): Promise<PlatformOption[]> {
    return PLATFORMS;
  }

  async readSettings(): Promise<PlatformSettingEntry[]> {
    return this.settings;
  }

  async writeSettings(entries: PlatformSettingEntry[]): Promise<void> {
    this.written = entries;
    this.settings = entries;
  }
}

class FakeProfilesSource implements PlatformProfilesSource {
  profiles: PlatformProfileEntry[];
  written: PlatformProfileEntry[] | null = null;
  readThrows = false;

  constructor(initial: PlatformProfileEntry[] = []) {
    this.profiles = initial;
  }

  async readProfiles(): Promise<PlatformProfileEntry[]> {
    if (this.readThrows) throw new Error("platform_profiles unreachable");
    return this.profiles;
  }

  async writeProfiles(entries: PlatformProfileEntry[]): Promise<void> {
    this.written = entries;
    this.profiles = entries;
  }
}

function seedSettings(initial: PlatformSettingEntry[] = []): FakeSource {
  const fake = new FakeSource(initial);
  setPlatformSettingsSource(fake);
  return fake;
}

function seedProfiles(initial: PlatformProfileEntry[] = []): FakeProfilesSource {
  const fake = new FakeProfilesSource(initial);
  setPlatformProfilesSource(fake);
  return fake;
}

function profileEntry(patch: Partial<PlatformProfileEntry> = {}): PlatformProfileEntry {
  return { slug: "wallgold", ...emptyProfile(), ...patch };
}

function authedRequest(method: string, body?: unknown): Request {
  const token = createSessionToken(SECRET, Date.now());
  return new Request("https://tablo.gold/api/admin-platform-settings", {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

function anonRequest(method: string, body?: unknown): Request {
  return new Request("https://tablo.gold/api/admin-platform-settings", {
    method,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

const VALID_ENTRIES: PlatformSettingEntry[] = [
  { slug: "wallgold", in_chart: true, chart_color: "#E0921D", chart_order: 0, referral_url: null },
  { slug: "talasea", in_chart: true, chart_color: "#9b8ce8", chart_order: 1, referral_url: null },
  { slug: "milli", in_chart: false, chart_color: null, chart_order: null, referral_url: null },
  { slug: "tlyn", in_chart: false, chart_color: null, chart_order: null, referral_url: null },
];

beforeEach(() => {
  vi.stubEnv("TABLO_ADMIN_SESSION_SECRET", SECRET);
  seedProfiles();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetPlatformSettingsSource();
  resetPlatformProfilesSource();
});

describe("GET /api/admin-platform-settings", () => {
  it("without a valid session ⟸ 401", async () => {
    seedSettings();
    const response = await adminPlatformSettingsGetResponse(anonRequest("GET"));
    expect(response.status).toBe(401);
  });

  it("with a valid session ⟸ 200, the platform list is merged with saved settings", async () => {
    seedSettings([
      {
        slug: "wallgold",
        in_chart: true,
        chart_color: "#e0921d",
        chart_order: 0,
        referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}`,
      },
    ]);

    const response = await adminPlatformSettingsGetResponse(authedRequest("GET"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      platforms: PlatformOption[];
      settings: PlatformSettingEntry[];
    };
    expect(body.platforms).toEqual(PLATFORMS);

    const wallgold = body.settings.find((s) => s.slug === "wallgold");
    expect(wallgold).toEqual({
      slug: "wallgold",
      in_chart: true,
      chart_color: "#e0921d",
      chart_order: 0,
      referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}`,
    });

    const talasea = body.settings.find((s) => s.slug === "talasea");
    expect(talasea).toEqual({
      slug: "talasea",
      in_chart: false,
      chart_color: null,
      chart_order: null,
      referral_url: null,
    });
  });
});

describe("POST /api/admin-platform-settings", () => {
  it("without a valid session ⟸ 401, nothing is written", async () => {
    const fake = seedSettings();
    const response = await adminPlatformSettingsPostResponse(
      anonRequest("POST", { entries: VALID_ENTRIES }),
    );
    expect(response.status).toBe(401);
    expect(fake.written).toBeNull();
  });

  it("invalid body ⟸ 400", async () => {
    seedSettings();
    expect(
      (await adminPlatformSettingsPostResponse(authedRequest("POST", "{ نه JSON"))).status,
    ).toBe(400);
    expect(
      (await adminPlatformSettingsPostResponse(authedRequest("POST", { entries: "نه آرایه" })))
        .status,
    ).toBe(400);
    expect(
      (
        await adminPlatformSettingsPostResponse(
          authedRequest("POST", { entries: [{ slug: "wallgold" }] }),
        )
      ).status,
    ).toBe(400);
  });

  it("fewer than 2 active platforms ⟸ 400, nothing is written", async () => {
    const fake = seedSettings();
    const entries = VALID_ENTRIES.map((e) =>
      e.slug === "talasea" ? { ...e, in_chart: false } : e,
    );
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("more than 6 active platforms ⟸ 400", async () => {
    const fake = seedSettings();
    const platforms: PlatformOption[] = Array.from({ length: 7 }, (_, i) => ({
      slug: `p${i}`,
      name_fa: `سکو ${i}`,
      website_url: null,
    }));
    fake.listPlatforms = async () => platforms;
    const entries: PlatformSettingEntry[] = platforms.map((p, i) => ({
      slug: p.slug,
      in_chart: true,
      chart_color: "#123456",
      chart_order: i,
      referral_url: null,
    }));
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("malformed color ⟸ 400", async () => {
    const fake = seedSettings();
    const entries = VALID_ENTRIES.map((e) =>
      e.slug === "wallgold" ? { ...e, chart_color: "not-a-color" } : e,
    );
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("unknown/unlisted slug ⟸ 400", async () => {
    const fake = seedSettings();
    const entries = [
      ...VALID_ENTRIES,
      {
        slug: "goldika",
        in_chart: false,
        chart_color: null,
        chart_order: null,
        referral_url: null,
      },
    ];
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("valid write ⟸ 200, color is lowercased and inactive entries get null color/order", async () => {
    const fake = seedSettings();
    const response = await adminPlatformSettingsPostResponse(
      authedRequest("POST", { entries: VALID_ENTRIES }),
    );
    expect(response.status).toBe(200);
    expect(fake.written).not.toBeNull();

    const wallgold = fake.written!.find((e) => e.slug === "wallgold")!;
    expect(wallgold.chart_color).toBe("#e0921d");

    const milli = fake.written!.find((e) => e.slug === "milli")!;
    expect(milli.chart_color).toBeNull();
    expect(milli.chart_order).toBeNull();
  });

  it("other method ⟸ 405 with Allow header", () => {
    const response = adminPlatformSettingsMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("all responses are uncached and non-indexable", async () => {
    seedSettings();
    for (const response of [
      await adminPlatformSettingsGetResponse(anonRequest("GET")),
      await adminPlatformSettingsGetResponse(authedRequest("GET")),
      await adminPlatformSettingsPostResponse(authedRequest("POST", { entries: VALID_ENTRIES })),
      adminPlatformSettingsMethodNotAllowed(),
    ]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });

  describe("referral URL", () => {
    it("rejects an insecure scheme (http) with a clear message, nothing is written", async () => {
      const fake = seedSettings();
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold" ? { ...e, referral_url: `http://wallgold.ir/r/${REFERRAL_CODE}` } : e,
      );
      const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
      expect(response.status).toBe(400);
      expect(fake.written).toBeNull();
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("wallgold");
      expect(body.error).not.toContain(REFERRAL_CODE);
    });

    it("rejects an unrelated domain with a clear message, nothing is written", async () => {
      const fake = seedSettings();
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold"
          ? { ...e, referral_url: `https://evil.example/r/${REFERRAL_CODE}` }
          : e,
      );
      const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
      expect(response.status).toBe(400);
      expect(fake.written).toBeNull();
    });

    it("accepts and saves a subdomain of the same platform", async () => {
      const fake = seedSettings();
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold"
          ? { ...e, referral_url: `https://app.wallgold.ir/r/${REFERRAL_CODE}` }
          : e,
      );
      const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
      expect(response.status).toBe(200);
      const wallgold = fake.written!.find((entry) => entry.slug === "wallgold")!;
      expect(wallgold.referral_url).toBe(`https://app.wallgold.ir/r/${REFERRAL_CODE}`);
    });

    it("clearing an existing referral URL removes the override (null is saved)", async () => {
      const fake = seedSettings([
        {
          slug: "wallgold",
          in_chart: true,
          chart_color: "#e0921d",
          chart_order: 0,
          referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}`,
        },
      ]);
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold" ? { ...e, referral_url: "" } : e,
      );
      const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
      expect(response.status).toBe(200);
      const wallgold = fake.written!.find((entry) => entry.slug === "wallgold")!;
      expect(wallgold.referral_url).toBeNull();
    });

    it("the successful response does not print the referral URL itself", async () => {
      seedSettings();
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold"
          ? { ...e, referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}` }
          : e,
      );
      const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
      const raw = await response.clone().text();
      expect(raw).not.toContain(REFERRAL_CODE);
    });

    it("logs the changed referral URL without printing the URL itself", async () => {
      seedSettings();
      const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold"
          ? { ...e, referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}` }
          : e,
      );
      await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));

      expect(spy).toHaveBeenCalled();
      const loggedText = spy.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(loggedText).toContain("wallgold");
      expect(loggedText).not.toContain(REFERRAL_CODE);
    });

    it("the platform profile never leaks into the referral log", async () => {
      seedSettings();
      seedProfiles();
      const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: [profileEntry({ kyc_level: "BASIC" })],
        }),
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it("logs nothing when the referral URL is unchanged", async () => {
      seedSettings([
        {
          slug: "wallgold",
          in_chart: true,
          chart_color: "#e0921d",
          chart_order: 0,
          referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}`,
        },
      ]);
      const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const entries = VALID_ENTRIES.map((e) =>
        e.slug === "wallgold"
          ? { ...e, referral_url: `https://wallgold.ir/r/${REFERRAL_CODE}` }
          : e,
      );
      await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("platform profile", () => {
    it("GET returns one profile row per listed platform, empty when nothing is saved", async () => {
      seedSettings();
      seedProfiles();
      const response = await adminPlatformSettingsGetResponse(authedRequest("GET"));
      const body = (await response.json()) as { profiles: PlatformProfileEntry[] };
      expect(body.profiles.map((p) => p.slug)).toEqual(PLATFORMS.map((p) => p.slug));
      expect(body.profiles[0]).toEqual(profileEntry());
    });

    it("GET merges the saved profile onto the platform list", async () => {
      seedSettings();
      seedProfiles([profileEntry({ min_buy_toman: 100000, payment_methods: ["GATEWAY"] })]);
      const response = await adminPlatformSettingsGetResponse(authedRequest("GET"));
      const body = (await response.json()) as { profiles: PlatformProfileEntry[] };
      const wallgold = body.profiles.find((p) => p.slug === "wallgold")!;
      expect(wallgold.min_buy_toman).toBe(100000);
      expect(wallgold.payment_methods).toEqual(["GATEWAY"]);
    });

    /** ⚠️ "Staleness, not error": the chart settings must stay editable even
     * when the profile table is unreachable. */
    it("an unreachable profile table degrades to empty profiles, not to a 500", async () => {
      seedSettings();
      const profiles = seedProfiles();
      profiles.readThrows = true;
      const response = await adminPlatformSettingsGetResponse(authedRequest("GET"));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { profiles: PlatformProfileEntry[] };
      expect(body.profiles).toEqual(PLATFORMS.map((p) => profileEntry({ slug: p.slug })));
    });

    it("a valid profile is normalized and written", async () => {
      seedSettings();
      const profiles = seedProfiles();
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: [
            profileEntry({
              payment_methods: ["WALLET", "GATEWAY"],
              kyc_level: "FULL",
              mobile_app: "ANDROID",
              delivery_cost_fa: "  ارسال رایگان  ",
              min_buy_toman: 100000,
              pros_fa: ["کارمزد پایین", "  "],
              faq: [{ question_fa: "چطور؟", answer_fa: "این‌طور" }],
            }),
          ],
        }),
      );
      expect(response.status).toBe(200);
      const written = profiles.written![0]!;
      expect(written.payment_methods).toEqual(["GATEWAY", "WALLET"]);
      expect(written.delivery_cost_fa).toBe("ارسال رایگان");
      expect(written.pros_fa).toEqual(["کارمزد پایین"]);
      expect(written.faq).toHaveLength(1);
    });

    it("a POST without a profiles key leaves the saved profiles untouched", async () => {
      seedSettings();
      const profiles = seedProfiles([profileEntry({ kyc_level: "BASIC" })]);
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", { entries: VALID_ENTRIES }),
      );
      expect(response.status).toBe(200);
      expect(profiles.written).toBeNull();
    });

    it("an unknown enum value ⟸ 400, nothing is written", async () => {
      seedSettings();
      const profiles = seedProfiles();
      for (const bad of [{ kyc_level: "SUPER" }, { mobile_app: "SYMBIAN" }]) {
        const response = await adminPlatformSettingsPostResponse(
          authedRequest("POST", {
            entries: VALID_ENTRIES,
            profiles: [{ ...profileEntry(), ...bad }],
          }),
        );
        expect(response.status).toBe(400);
      }
      expect(profiles.written).toBeNull();
    });

    it("a non-positive minimum ⟸ 400, nothing is written", async () => {
      seedSettings();
      const profiles = seedProfiles();
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: [{ ...profileEntry(), min_buy_toman: 0 }],
        }),
      );
      expect(response.status).toBe(400);
      expect(profiles.written).toBeNull();
    });

    it("a profile for a platform outside the settings payload ⟸ 400", async () => {
      seedSettings();
      const profiles = seedProfiles();
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: [profileEntry({ slug: "goldika", kyc_level: "BASIC" })],
        }),
      );
      expect(response.status).toBe(400);
      expect(profiles.written).toBeNull();
    });

    it("a body larger than the cap ⟸ 400 before anything is parsed", async () => {
      seedSettings();
      const profiles = seedProfiles();
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: [profileEntry({ delivery_cost_fa: "ا".repeat(300_000) })],
        }),
      );
      expect(response.status).toBe(400);
      expect(profiles.written).toBeNull();
    });

    it("prose long enough to be a real profile still fits inside the cap", async () => {
      seedSettings();
      const profiles = seedProfiles();
      const response = await adminPlatformSettingsPostResponse(
        authedRequest("POST", {
          entries: VALID_ENTRIES,
          profiles: PLATFORMS.map((platform) =>
            profileEntry({
              slug: platform.slug,
              pros_fa: ["ا".repeat(200), "ب".repeat(200)],
              cons_fa: ["پ".repeat(200)],
              faq: [{ question_fa: "ت".repeat(100), answer_fa: "ث".repeat(1000) }],
            }),
          ),
        }),
      );
      expect(response.status).toBe(200);
      expect(profiles.written).toHaveLength(PLATFORMS.length);
    });
  });
});
