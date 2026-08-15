/**
 * ⚠️ This module has no price formula and no cross-platform number (rules 1
 * and 4), and has no Node dependency, so importing it from either side is
 * safe.
 */
import {
  getInstruments,
  getListedPlatforms,
  type InstrumentListing,
  type ListedPlatform,
} from "./prices";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "./registry";

export async function listPlatforms(): Promise<ListedPlatform[]> {
  const live = await getListedPlatforms();
  return live.length > 0 ? live : [...REGISTRY_PLATFORMS];
}

export async function listInstruments(): Promise<InstrumentListing[]> {
  const live = await getInstruments();
  return live.length > 0 ? live : [...REGISTRY_INSTRUMENTS];
}
