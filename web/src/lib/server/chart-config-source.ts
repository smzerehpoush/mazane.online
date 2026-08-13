import "@tanstack/react-start/server-only";

import Redis from "ioredis";

import {
  getChartPlatforms as readChartPlatforms,
  setDefaultChartConfigSource,
  type ChartConfigSource,
} from "../chart-config";
import { parseChartConfigPayload, type ChartPlatformConfig } from "../site-content";

const CHART_CONFIG_KEY = "tablo:chart_config";

let client: Redis | null = null;

function redisClient(): Redis {
  if (client === null) {
    client = new Redis(process.env["TABLO_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
      maxRetriesPerRequest: 1,
    });
  }
  return client;
}

export function createRedisChartConfigSource(): ChartConfigSource {
  return {
    async getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined> {
      return parseChartConfigPayload(await redisClient().get(CHART_CONFIG_KEY));
    },
  };
}

let registered = false;

function ensureDefaultSource(): void {
  if (registered) return;
  registered = true;
  setDefaultChartConfigSource(createRedisChartConfigSource);
}

export async function getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined> {
  ensureDefaultSource();
  return readChartPlatforms();
}
