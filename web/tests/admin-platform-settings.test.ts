/**
 * مرز وب — تنظیمات نمودار پنل مدیریت (بلیت ۲۱) + نشانی معرف (بلیت ۲۳):
 * منبع تزریق‌شده ⟸ پاسخ endpoint.
 *
 * همان مرز `post-view.ts`/`admin-login.ts`: منطق در
 * `lib/server/admin-platform-settings.ts` مستقیم از تست صدا زده می‌شود،
 * بدون بالا آوردن سرور یا اتصال واقعی به پستگرس/ردیس — منبع دامنه
 * (`lib/platform-settings.ts::setPlatformSettingsSource`) با فیک درون‌حافظه‌ای
 * seed می‌شود.
 *
 * سنجیده می‌شود:
 *   ۱. بدون نشست معتبر ⟸ ۴۰۱ (هم GET هم POST).
 *   ۲. GET فهرست سکوهای قابل نمایش را با تنظیمات ذخیره‌شده ادغام می‌کند —
 *      سکوی بی‌ردیف پیش‌فرض «هنوز تنظیم نشده» می‌گیرد.
 *   ۳. کمتر از ۲ یا بیش از ۶ سکوی in_chart=true ⟸ ۴۰۰، چیزی نوشته نمی‌شود.
 *   ۴. رنگ بدشکل ⟸ ۴۰۰.
 *   ۵. اسلاگ ناشناخته/غیرقابل‌نمایش ⟸ ۴۰۰.
 *   ۶. نوشتن معتبر ⟸ ۲۰۰، رنگ lower و غیرفعال‌ها رنگ/ترتیب null می‌شوند.
 *   ۷. همه‌ی پاسخ‌ها بی‌کش و بدون اجازه‌ی نمایه‌سازی‌اند.
 *   ۸. (بلیت ۲۳) طرح ناامن/دامنه‌ی نامرتبط نشانی معرف ⟸ ۴۰۰؛ زیردامنه‌ی
 *      همان سکو پذیرفته می‌شود؛ نشانی معرف هرگز در پاسخ چاپ نمی‌شود.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "../src/lib/admin-auth";
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

function seedSettings(initial: PlatformSettingEntry[] = []): FakeSource {
  const fake = new FakeSource(initial);
  setPlatformSettingsSource(fake);
  return fake;
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetPlatformSettingsSource();
});

describe("GET /api/admin-platform-settings", () => {
  it("بدون نشست معتبر ⟸ ۴۰۱", async () => {
    seedSettings();
    const response = await adminPlatformSettingsGetResponse(anonRequest("GET"));
    expect(response.status).toBe(401);
  });

  it("با نشست معتبر ⟸ ۲۰۰، فهرست سکوها با تنظیمات ذخیره‌شده ادغام می‌شود", async () => {
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

    // سکوی بی‌ردیف در platform_settings پیش‌فرض «هنوز تنظیم نشده» می‌گیرد.
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
  it("بدون نشست معتبر ⟸ ۴۰۱، چیزی نوشته نمی‌شود", async () => {
    const fake = seedSettings();
    const response = await adminPlatformSettingsPostResponse(
      anonRequest("POST", { entries: VALID_ENTRIES }),
    );
    expect(response.status).toBe(401);
    expect(fake.written).toBeNull();
  });

  it("بدنه‌ی نامعتبر ⟸ ۴۰۰", async () => {
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

  it("کمتر از ۲ سکوی فعال ⟸ ۴۰۰، چیزی نوشته نمی‌شود", async () => {
    const fake = seedSettings();
    const entries = VALID_ENTRIES.map((e) =>
      e.slug === "talasea" ? { ...e, in_chart: false } : e,
    );
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("بیش از ۶ سکوی فعال ⟸ ۴۰۰", async () => {
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

  it("رنگ بدشکل ⟸ ۴۰۰", async () => {
    const fake = seedSettings();
    const entries = VALID_ENTRIES.map((e) =>
      e.slug === "wallgold" ? { ...e, chart_color: "not-a-color" } : e,
    );
    const response = await adminPlatformSettingsPostResponse(authedRequest("POST", { entries }));
    expect(response.status).toBe(400);
    expect(fake.written).toBeNull();
  });

  it("اسلاگ ناشناخته/غیرقابل‌نمایش ⟸ ۴۰۰", async () => {
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

  it("نوشتن معتبر ⟸ ۲۰۰، رنگ lower و غیرفعال‌ها رنگ/ترتیب null می‌شوند", async () => {
    const fake = seedSettings();
    const response = await adminPlatformSettingsPostResponse(
      authedRequest("POST", { entries: VALID_ENTRIES }),
    );
    expect(response.status).toBe(200);
    expect(fake.written).not.toBeNull();

    const wallgold = fake.written!.find((e) => e.slug === "wallgold")!;
    expect(wallgold.chart_color).toBe("#e0921d"); // lower شد

    const milli = fake.written!.find((e) => e.slug === "milli")!;
    expect(milli.chart_color).toBeNull();
    expect(milli.chart_order).toBeNull();
  });

  it("متد دیگر ⟸ ۴۰۵ با هدر Allow", () => {
    const response = adminPlatformSettingsMethodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });

  it("همه‌ی پاسخ‌ها بی‌کش و بدون اجازه‌ی نمایه‌سازی‌اند", async () => {
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

  describe("نشانی معرف (بلیت ۲۳)", () => {
    it("طرح ناامن (http) را با پیام روشن رد می‌کند، چیزی نوشته نمی‌شود", async () => {
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

    it("دامنه‌ی نامرتبط را با پیام روشن رد می‌کند، چیزی نوشته نمی‌شود", async () => {
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

    it("زیردامنه‌ی همان سکو را می‌پذیرد و ذخیره می‌کند", async () => {
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

    it("خالی‌کردن نشانی معرف موجود، override را حذف می‌کند (null ذخیره می‌شود)", async () => {
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

    it("پاسخ موفق خودِ نشانی معرف را چاپ نمی‌کند", async () => {
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

    it("نشانی معرف تغییرکرده را لاگ می‌کند، بدون چاپ خودِ نشانی", async () => {
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

    it("بدون تغییر نشانی معرف، چیزی لاگ نمی‌شود", async () => {
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
});
