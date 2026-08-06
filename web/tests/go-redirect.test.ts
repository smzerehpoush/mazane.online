/**
 * مرز وب — بلیت ۹ (بند ۱۳، تصمیم ۲۱): ریدایرکت ‎/go/<slug>‎.
 *
 * قرارداد: سکوی دارای referral_url ⟸ همان؛ وگرنه website_url (لینک
 * مستقیم — کد معرف هنوز از صاحب کسب‌وکار نرسیده)؛ نه این نه آن، یا اسلاگ
 * ناشناخته ⟸ 404. ریدایرکت **302** است نه 301 (مقصد با رسیدن کدها عوض
 * می‌شود) و پاسخ همیشه ‎X-Robots-Tag: noindex‎ دارد (بند ۶.۴ — ‎/go/‎ در
 * روبوتس هم بسته است). کد معرف هرگز در لاگ نمی‌آید.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/go/[slug]/route";
import type { ListedPlatform } from "../lib/prices";
import { setPriceSource } from "../lib/prices";

const REFERRAL_CODE = "MZN-SECRET-4242";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    website_url: "https://milli.gold",
    referral_url: `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    referral_param: "referralCode",
  },
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    website_url: "https://wallgold.ir",
  },
  // سکوی بدون هیچ نشانی مستند — ‎/go/‎ چیزی برای رفتن ندارد.
  { slug: "bihich", name_fa: "بی‌هیچ", data_policy: "ALLOWED" },
];

function seedPlatforms(): void {
  setPriceSource({
    getListedPlatforms: async () => PLATFORMS,
    getSnapshot: async () => null,
    getUpdatedAt: async () => null,
    getInstruments: async () => [],
  });
}

function requestFor(slug: string): [Request, { params: Promise<{ slug: string }> }] {
  return [
    new Request(`https://mazane.online/go/${slug}`),
    { params: Promise.resolve({ slug }) },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /go/<slug> — ریدایرکت معرف (تصمیم ۲۱)", () => {
  it("سکوی دارای referral_url ⟸ 302 به همان، با X-Robots-Tag: noindex", async () => {
    seedPlatforms();
    const response = await GET(...requestFor("milli"));
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("سکوی بدون کد معرف ⟸ 302 مستقیم به website_url (کدها بعداً می‌رسند)", async () => {
    seedPlatforms();
    const response = await GET(...requestFor("wallgold"));
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://wallgold.ir");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("اسلاگ ناشناخته ⟸ 404", async () => {
    seedPlatforms();
    const response = await GET(...requestFor("hich-vaght-nabude"));
    expect(response.status).toBe(404);
  });

  it("سکوی بدون referral_url و بدون website_url ⟸ 404، نه ریدایرکت خالی", async () => {
    seedPlatforms();
    const response = await GET(...requestFor("bihich"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("ریدایرکت موقتی است (302) نه 301 — مقصد با رسیدن کد معرف عوض می‌شود", async () => {
    seedPlatforms();
    for (const slug of ["milli", "wallgold"]) {
      const response = await GET(...requestFor(slug));
      expect(response.status).toBe(302);
    }
  });

  it("کد معرف هرگز وارد لاگ نمی‌شود", async () => {
    seedPlatforms();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );

    await GET(...requestFor("milli"));

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(REFERRAL_CODE);
      }
    }
  });
});
