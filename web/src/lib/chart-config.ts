/**
 * ⚠️ Why this layer was added: before the redesign, the only consumer of
 * the config was `assembleHomeData`, whose reader was injected, so tests
 * never reached Redis. With the redesign, `/api/prices` also came to need
 * this same config (axis geometry depends on the list of sources), and
 * without this seam, that route's tests would connect to **real** Redis —
 * violating "tests pass green without a live service".
 */
import type { ChartPlatformConfig } from "./site-content";

export interface ChartConfigSource {
  getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined>;
}

export type ChartConfigSourceFactory = () => ChartConfigSource;

let activeSource: ChartConfigSource | null = null;
let defaultFactory: ChartConfigSourceFactory | null = null;

export function setChartConfigSource(source: ChartConfigSource): void {
  activeSource = source;
}

export function setDefaultChartConfigSource(factory: ChartConfigSourceFactory): void {
  defaultFactory = factory;
}

/**
 * ⚠️ Unlike `getPlatformSnapshot`, a missing registered source is also
 * **not an error**: config is a preference, not data, and the code's
 * default list is always a valid answer. This differs from `lib/prices.ts`,
 * which deliberately fails loudly — there, a missing source means an empty
 * 200 page that Google indexes.
 */
export async function getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined> {
  const source =
    activeSource ?? (defaultFactory === null ? null : (activeSource = defaultFactory()));
  if (source === null) return undefined;
  try {
    return await source.getChartPlatforms();
  } catch {
    return undefined;
  }
}
