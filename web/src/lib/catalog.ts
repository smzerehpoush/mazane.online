/**
 * ⚠️ این ماژول هیچ فرمول قیمتی و هیچ عدد بین‌سکویی ندارد (قاعده‌های ۱ و ۴)
 * و هیچ وابستگی نودی ندارد، پس import شدنش از هر دو سو بی‌خطر است.
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
