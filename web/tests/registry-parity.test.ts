import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emptyProfile } from "../src/lib/platform-profile";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "../src/lib/registry";
import { RESERVED_WORDS, STATIC_PAGE_SLUGS } from "../src/lib/slugs";

interface CollectorPlatform {
  slug: string;
  name_fa: string;
  data_policy: string;
  market_model: string;
  name_en: string | null;
  website_url: string | null;
  legal_entity: string | null;
  founded_year_jalali: number | null;
  delivery_note_fa: string | null;
}

interface CollectorInstrument {
  slug: string;
  instrument: string;
  name_fa: string;
  unit_fa: string;
  purity: string | null;
  currency: string;
}

interface CollectorRegistry {
  platforms: CollectorPlatform[];
  instruments: CollectorInstrument[];
  platform_model_fields: string[];
  platform_profile_fields: string[];
  adapters: Record<string, string[]>;
  publish_gate_min_platforms: number;
  reserved_words: string[];
  static_page_slugs: string[];
}

const SCRIPT = fileURLToPath(new URL("./support/dump-collector-registry.py", import.meta.url));
const COLLECTOR = fileURLToPath(new URL("../../collector/src/tablo_collector", import.meta.url));

function collectorRegistry(): CollectorRegistry {
  const stdout = execFileSync("python3", [SCRIPT, COLLECTOR], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as CollectorRegistry;
}

const registry = collectorRegistry();

const listed = registry.platforms.filter((p) => p.data_policy === "ALLOWED");

function asListedPlatform(platform: CollectorPlatform): ListedPlatform {
  return {
    slug: platform.slug,
    name_fa: platform.name_fa,
    data_policy: "ALLOWED",
    market_model: platform.market_model === "ORDER_BOOK" ? "ORDER_BOOK" : "OTC",
    name_en: platform.name_en,
    website_url: platform.website_url,
    legal_entity: platform.legal_entity,
    founded_year_jalali: platform.founded_year_jalali,
    delivery_note_fa: platform.delivery_note_fa,
  };
}

function asInstrumentListing(info: CollectorInstrument): InstrumentListing {
  const supporting = listed
    .filter((platform) => (registry.adapters[platform.slug] ?? []).includes(info.instrument))
    .map((platform) => platform.slug);
  return {
    slug: info.slug,
    instrument: info.instrument,
    name_fa: info.name_fa,
    unit_fa: info.unit_fa,
    purity: info.purity,
    currency: info.currency,
    supporting_platform_slugs: supporting,
    published: supporting.length >= registry.publish_gate_min_platforms,
  };
}

describe("the web's static registry matches the collector's code registry", () => {
  it("the extractor script actually picked something up (otherwise an empty test passes)", () => {
    expect(registry.platforms.length).toBeGreaterThan(1);
    expect(registry.instruments.length).toBeGreaterThan(1);
    expect(Object.keys(registry.adapters).length).toBeGreaterThan(1);
  });

  it("listed platforms: same set, same order, same metadata", () => {
    expect(REGISTRY_PLATFORMS).toEqual(listed.map(asListedPlatform));
  });

  /**
   * ⚠️ `/go/<slug>` resolves `referral_url ?? website_url`, but the wizard and
   * the platform page decide whether to *show* an exit button from
   * `website_url` alone — they have to, because `withoutReferral` strips the
   * referral field before the row ever reaches them, and reading it there
   * would be the exact monetization input the ordering rules forbid. That
   * asymmetry is only harmless while every listed platform has a website: a
   * platform with a referral link and no site would silently lose its button.
   */
  it("every listed platform has a website_url, so a stripped row can still decide it has an exit", () => {
    for (const platform of REGISTRY_PLATFORMS) {
      expect(platform.website_url, platform.slug).toEqual(expect.any(String));
    }
  });

  it("a platform outside ALLOWED never reaches the web's public listing", () => {
    const pending = registry.platforms
      .filter((p) => p.data_policy !== "ALLOWED")
      .map((p) => p.slug);
    for (const slug of pending) {
      expect(REGISTRY_PLATFORMS.map((p) => p.slug)).not.toContain(slug);
    }
    expect(REGISTRY_PLATFORMS.every((p) => p.data_policy === "ALLOWED")).toBe(true);
  });

  it("instruments: same set and metadata, with the publish gate reconstructed", () => {
    expect(REGISTRY_INSTRUMENTS).toEqual(registry.instruments.map(asInstrumentListing));
  });

  /**
   * ⚠️ This is the direction the field-by-field comparison above cannot see:
   * a new field on the collector's `Platform` that nobody mirrors would sit
   * there silently, exactly the way `min_order_toman` did. Adding a field to
   * `Platform` therefore forces a choice — mirror it in the static registry,
   * or name it here and say why it is not mirrored.
   */
  const NOT_MIRRORED_IN_THE_STATIC_REGISTRY = new Set([
    "profile",
    "referral_url",
    "referral_param",
  ]);

  it("every field on the collector's Platform is either mirrored or explicitly excluded", () => {
    const mirrored = new Set(Object.keys(listed.map(asListedPlatform)[0] ?? {}));
    const unaccounted = registry.platform_model_fields.filter(
      (field) => !mirrored.has(field) && !NOT_MIRRORED_IN_THE_STATIC_REGISTRY.has(field),
    );
    expect(unaccounted).toEqual([]);
  });

  it("the web's profile shape matches the collector's PlatformProfile field for field", () => {
    expect([...registry.platform_profile_fields].sort()).toEqual(
      Object.keys(emptyProfile()).sort(),
    );
  });

  it("a profile field never reaches the static registry, so an outage cannot fake one", () => {
    for (const platform of REGISTRY_PLATFORMS) {
      expect(platform.profile).toBeUndefined();
    }
  });

  it("reserved words and static pages match the collector in both directions", () => {
    expect([...RESERVED_WORDS].sort()).toEqual([...registry.reserved_words].sort());
    expect([...STATIC_PAGE_SLUGS].sort()).toEqual([...registry.static_page_slugs].sort());
  });
});
