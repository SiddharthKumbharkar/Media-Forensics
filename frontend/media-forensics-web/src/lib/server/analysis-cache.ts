import type { AnalysisResponse } from "@/lib/analysis/types";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  value: AnalysisResponse;
}

const globalCache = globalThis as typeof globalThis & {
  __mediaForensicsAnalysisCache?: Map<string, CacheEntry>;
};

function getCacheStore() {
  if (!globalCache.__mediaForensicsAnalysisCache) {
    globalCache.__mediaForensicsAnalysisCache = new Map<string, CacheEntry>();
  }

  return globalCache.__mediaForensicsAnalysisCache;
}

function cloneValue(value: AnalysisResponse): AnalysisResponse {
  return JSON.parse(JSON.stringify(value)) as AnalysisResponse;
}

export function getCachedAnalysis(key: string): AnalysisResponse | null {
  const cache = getCacheStore();
  const cached = cache.get(key);

  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cloneValue(cached.value);
}

export function setCachedAnalysis(key: string, value: AnalysisResponse) {
  const cache = getCacheStore();
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: cloneValue(value),
  });
}
