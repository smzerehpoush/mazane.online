import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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

  it("reserved words and static pages haven't fallen behind the collector", () => {
    for (const word of registry.reserved_words) {
      expect(RESERVED_WORDS.has(word)).toBe(true);
    }
    for (const slug of registry.static_page_slugs) {
      expect(STATIC_PAGE_SLUGS.has(slug)).toBe(true);
    }
  });
});
