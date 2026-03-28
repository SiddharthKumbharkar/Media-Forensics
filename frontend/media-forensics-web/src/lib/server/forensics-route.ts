import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { detectMediaType, isAllowedMediaFile } from "@/lib/analysis/media";
import type {
  AnalysisBreakdownItem,
  AnalysisEngineLabel,
  AnalysisResponse,
  AnalysisSource,
  ForensicMode,
  MediaType,
} from "@/lib/analysis/types";
import { runExternalInference } from "@/lib/external/inferenceClient";
import { fuseNormalizedResults, normalizeInternalResult } from "@/lib/mappers/normalizeResult";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/server/analysis-cache";

const EXTERNAL_REQUEST_TIMEOUT_MS = 5_000;
const INTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_ANALYSIS_TIMEOUT_MS || "20000");
const HEALTH_CHECK_TIMEOUT_MS = 1_500;

const DEFAULT_LAYER1_BASE_URL = "http://127.0.0.1:8000";
const LOCALHOST_LAYER1_BASE_URL = "http://localhost:8000";
const DEFAULT_VIDEO_BASE_URL = "http://127.0.0.1:8001";
const LOCALHOST_VIDEO_BASE_URL = "http://localhost:8001";

interface InternalTargetConfig {
  analyzePath: string;
  healthPath: string;
  getCandidateUrls: () => string[];
}

interface HandleAnalyzeRequestOptions {
  request: Request;
  mediaType?: MediaType;
}

class AnalysisGatewayError extends Error {
  status: number;
  expose: boolean;

  constructor(message: string, status = 500, expose = true) {
    super(message);
    this.name = "AnalysisGatewayError";
    this.status = status;
    this.expose = expose;
  }
}

const INTERNAL_TARGETS: Record<MediaType, InternalTargetConfig> = {
  image: {
    analyzePath: "/analyze/image",
    healthPath: "/health",
    getCandidateUrls: () =>
      getCandidateUrls([process.env.LAYER1_API_BASE_URL, DEFAULT_LAYER1_BASE_URL, LOCALHOST_LAYER1_BASE_URL]),
  },
  audio: {
    analyzePath: "/analyze/audio",
    healthPath: "/health",
    getCandidateUrls: () =>
      getCandidateUrls([
        process.env.AUDIO_FORENSICS_API_BASE_URL || process.env.LAYER1_API_BASE_URL,
        DEFAULT_LAYER1_BASE_URL,
        LOCALHOST_LAYER1_BASE_URL,
      ]),
  },
  video: {
    analyzePath: "/detect",
    healthPath: "/health",
    getCandidateUrls: () =>
      getCandidateUrls([
        process.env.VIDEO_FORENSICS_API_BASE_URL || process.env.DEEPSAFE_API_BASE_URL,
        DEFAULT_VIDEO_BASE_URL,
        LOCALHOST_VIDEO_BASE_URL,
      ]),
  },
};

function logGateway(level: "info" | "warn" | "error", event: string, payload: Record<string, unknown>) {
  console[level](`[analysis-gateway] ${event} ${JSON.stringify(payload)}`);
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}

function parseMediaTypeValue(value: FormDataEntryValue | string | null | undefined): MediaType | null {
  if (value === "image" || value === "audio" || value === "video") {
    return value;
  }

  return null;
}

function getConfiguredMode(): ForensicMode {
  const mode = process.env.FORENSIC_MODE?.trim().toLowerCase();
  if (mode === "external" || mode === "hybrid") return mode;
  return "internal";
}

function hasExternalConfiguration(): boolean {
  return Boolean(process.env.EXTERNAL_INFERENCE_URL?.trim() && process.env.EXTERNAL_INFERENCE_KEY?.trim());
}

function getAnalysisEngineLabel(source: AnalysisSource): AnalysisEngineLabel {
  return source === "internal" ? "Standard" : "Enhanced";
}

async function buildCacheKey(file: File, mediaType: MediaType, mode: ForensicMode): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const digest = createHash("sha256").update(buffer).digest("hex");
  return `${mediaType}:${mode}:${digest}`;
}

async function parseErrorPayload(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const message = payload.detail || payload.message || payload.error;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    } catch {
      // Fall back to text below.
    }
  }

  try {
    const text = await response.text();
    return text.trim() || `Analysis request failed (${response.status})`;
  } catch {
    return `Analysis request failed (${response.status})`;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? EXTERNAL_REQUEST_TIMEOUT_MS;
  const timeoutMessage = options?.timeoutMessage ?? "Analysis request timed out";
  const { signal, cancel } = createTimeoutSignal(timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AnalysisGatewayError(timeoutMessage, 504, false);
    }
    throw error;
  } finally {
    cancel();
  }
}

async function runMeasuredAnalysis(
  source: AnalysisBreakdownItem["source"],
  execute: () => Promise<AnalysisBreakdownItem>,
): Promise<AnalysisBreakdownItem> {
  const startedAt = performance.now();
  const result = await execute();

  return {
    ...result,
    source,
    latency_ms: Math.round(performance.now() - startedAt),
  };
}

async function runInternalAnalysis(file: File, mediaType: MediaType): Promise<AnalysisBreakdownItem> {
  const config = INTERNAL_TARGETS[mediaType];
  const candidateUrls = config.getCandidateUrls();
  let lastNetworkError: string | null = null;

  if (candidateUrls.length === 0) {
    throw new AnalysisGatewayError("Internal analysis is not configured", 503, false);
  }

  return runMeasuredAnalysis("internal", async () => {
    for (const baseUrl of candidateUrls) {
      const relayFormData = new FormData();
      relayFormData.append("file", file, file.name || "uploaded_media");

      try {
        const response = await fetchWithTimeout(`${baseUrl}${config.analyzePath}`, {
          method: "POST",
          body: relayFormData,
        }, {
          timeoutMs: INTERNAL_REQUEST_TIMEOUT_MS,
          timeoutMessage: "Internal analysis request timed out",
        });

        if (!response.ok) {
          throw new AnalysisGatewayError(await parseErrorPayload(response), response.status, true);
        }

        const payload = (await response.json()) as unknown;
        return {
          ...normalizeInternalResult(mediaType, payload),
          latency_ms: 0,
        };
      } catch (error) {
        if (error instanceof AnalysisGatewayError && error.expose) {
          throw error;
        }

        if (error instanceof AnalysisGatewayError && error.status === 504) {
          throw error;
        }

        lastNetworkError =
          error instanceof Error ? error.message : "Internal network failure";
      }
    }

    throw new AnalysisGatewayError(lastNetworkError || "Internal analysis is unavailable", 503, false);
  });
}

async function runExternalAnalysis(file: File, mediaType: MediaType): Promise<AnalysisBreakdownItem> {
  return runMeasuredAnalysis("external", async () => {
    const result = await runExternalInference(file, mediaType);
    return {
      ...result,
      latency_ms: 0,
    };
  });
}

function buildSingleSourceResponse(params: {
  requestId: string;
  mediaType: MediaType;
  modeRequested: ForensicMode;
  result: AnalysisBreakdownItem;
  processingMs: number;
  cached: boolean;
  fallbackApplied?: boolean;
}): AnalysisResponse {
  const { requestId, mediaType, modeRequested, result, processingMs, cached, fallbackApplied } = params;

  return {
    request_id: requestId,
    media_type: mediaType,
    source: result.source,
    mode_requested: modeRequested,
    mode_used: result.source,
    analysis_engine: getAnalysisEngineLabel(result.source),
    fake_probability: result.fake_probability,
    final_score: result.fake_probability,
    final_verdict: result.verdict,
    confidence: result.confidence,
    uncertainty_score: result.uncertainty_score,
    processing_ms: processingMs,
    cached,
    fallback_applied: fallbackApplied,
  };
}

function buildHybridResponse(params: {
  requestId: string;
  mediaType: MediaType;
  modeRequested: ForensicMode;
  internalResult: AnalysisBreakdownItem;
  externalResult: AnalysisBreakdownItem;
  processingMs: number;
  cached: boolean;
}): AnalysisResponse {
  const { requestId, mediaType, modeRequested, internalResult, externalResult, processingMs, cached } = params;
  const fused = fuseNormalizedResults(externalResult, internalResult);

  return {
    request_id: requestId,
    media_type: mediaType,
    source: "hybrid",
    mode_requested: modeRequested,
    mode_used: "hybrid",
    analysis_engine: "Enhanced",
    fake_probability: fused.final_score,
    final_score: fused.final_score,
    final_verdict: fused.final_verdict,
    confidence: fused.confidence,
    uncertainty_score: fused.uncertainty_score,
    processing_ms: processingMs,
    cached,
    breakdown: {
      internal: internalResult,
      external: externalResult,
    },
  };
}

async function isInternalAvailable(mediaType: MediaType): Promise<boolean> {
  const config = INTERNAL_TARGETS[mediaType];

  for (const baseUrl of config.getCandidateUrls()) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${config.healthPath}`, { method: "GET" }, {
        timeoutMs: HEALTH_CHECK_TIMEOUT_MS,
        timeoutMessage: "Internal health check timed out",
      });
      if (response.ok) return true;
    } catch {
      // Try the next candidate URL.
    }
  }

  return false;
}

function getRequestedMediaType(request: Request, formData: FormData, explicitMediaType?: MediaType): MediaType | null {
  if (explicitMediaType) return explicitMediaType;

  const mediaTypeFromBody = parseMediaTypeValue(formData.get("mediaType"));
  if (mediaTypeFromBody) return mediaTypeFromBody;

  const mediaTypeFromQuery = parseMediaTypeValue(new URL(request.url).searchParams.get("mediaType"));
  if (mediaTypeFromQuery) return mediaTypeFromQuery;

  const fileEntry = formData.get("file");
  if (fileEntry instanceof File) {
    return detectMediaType(fileEntry);
  }

  return null;
}

export function getCandidateUrls(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

export async function createAnalysisHealthResponse(mediaType?: MediaType) {
  const mode = getConfiguredMode();
  const internalReady = mediaType
    ? await isInternalAvailable(mediaType)
    : (await Promise.all((["image", "audio", "video"] as MediaType[]).map((entry) => isInternalAvailable(entry)))).some(Boolean);
  const externalReady = hasExternalConfiguration();
  const analysisAvailable = internalReady || externalReady;

  return NextResponse.json(
    {
      status: analysisAvailable ? "ok" : "degraded",
      analysis_available: analysisAvailable,
      active_mode: mode,
      media_type: mediaType || null,
      engines: {
        standard: internalReady,
        enhanced: externalReady,
      },
    },
    { status: 200 },
  );
}

export async function handleAnalyzeRequest({ request, mediaType }: HandleAnalyzeRequestOptions) {
  const startedAt = performance.now();

  try {
    const incoming = await request.formData();
    const fileEntry = incoming.get("file");

    if (!(fileEntry instanceof File)) {
      throw new AnalysisGatewayError("File field is required", 400, true);
    }

    const requestedMediaType = getRequestedMediaType(request, incoming, mediaType);
    if (!requestedMediaType) {
      throw new AnalysisGatewayError("Media type could not be determined", 400, true);
    }

    if (!isAllowedMediaFile(requestedMediaType, fileEntry)) {
      throw new AnalysisGatewayError("Unsupported file type", 400, true);
    }

    const requestId = randomUUID();
    const configuredMode = getConfiguredMode();
    const cacheKey = await buildCacheKey(fileEntry, requestedMediaType, configuredMode);
    const cached = getCachedAnalysis(cacheKey);

    if (cached) {
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      const cachedResponse: AnalysisResponse = {
        ...cached,
        request_id: requestId,
        processing_ms: elapsedMs,
        cached: true,
      };

      logGateway("info", "cache-hit", {
        request_id: requestId,
        media_type: requestedMediaType,
        mode_requested: configuredMode,
        mode_used: cachedResponse.mode_used,
        processing_ms: elapsedMs,
      });

      return NextResponse.json(cachedResponse, { status: 200 });
    }

    let responsePayload: AnalysisResponse;

    if (configuredMode === "internal") {
      const internalResult = await runInternalAnalysis(fileEntry, requestedMediaType);
      responsePayload = buildSingleSourceResponse({
        requestId,
        mediaType: requestedMediaType,
        modeRequested: configuredMode,
        result: internalResult,
        processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
        cached: false,
      });
    } else if (configuredMode === "external") {
      try {
        const externalResult = await runExternalAnalysis(fileEntry, requestedMediaType);
        responsePayload = buildSingleSourceResponse({
          requestId,
          mediaType: requestedMediaType,
          modeRequested: configuredMode,
          result: externalResult,
          processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
          cached: false,
        });
      } catch (error) {
        logGateway("warn", "external-fallback", {
          request_id: requestId,
          media_type: requestedMediaType,
          mode_requested: configuredMode,
          reason: error instanceof Error ? error.message : "unknown",
        });

        const internalResult = await runInternalAnalysis(fileEntry, requestedMediaType);
        responsePayload = buildSingleSourceResponse({
          requestId,
          mediaType: requestedMediaType,
          modeRequested: configuredMode,
          result: internalResult,
          processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
          cached: false,
          fallbackApplied: true,
        });
      }
    } else {
      const [internalOutcome, externalOutcome] = await Promise.allSettled([
        runInternalAnalysis(fileEntry, requestedMediaType),
        runExternalAnalysis(fileEntry, requestedMediaType),
      ]);

      if (internalOutcome.status === "fulfilled" && externalOutcome.status === "fulfilled") {
        responsePayload = buildHybridResponse({
          requestId,
          mediaType: requestedMediaType,
          modeRequested: configuredMode,
          internalResult: internalOutcome.value,
          externalResult: externalOutcome.value,
          processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
          cached: false,
        });
      } else if (internalOutcome.status === "fulfilled") {
        logGateway("warn", "hybrid-degraded", {
          request_id: requestId,
          media_type: requestedMediaType,
          preferred_engine: "hybrid",
          fallback_engine: "internal",
          reason: externalOutcome.status === "rejected" ? String(externalOutcome.reason) : "external result unavailable",
        });

        responsePayload = buildSingleSourceResponse({
          requestId,
          mediaType: requestedMediaType,
          modeRequested: configuredMode,
          result: internalOutcome.value,
          processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
          cached: false,
          fallbackApplied: true,
        });
      } else if (externalOutcome.status === "fulfilled") {
        logGateway("warn", "hybrid-degraded", {
          request_id: requestId,
          media_type: requestedMediaType,
          preferred_engine: "hybrid",
          fallback_engine: "external",
          reason: internalOutcome.status === "rejected" ? String(internalOutcome.reason) : "internal result unavailable",
        });

        responsePayload = buildSingleSourceResponse({
          requestId,
          mediaType: requestedMediaType,
          modeRequested: configuredMode,
          result: externalOutcome.value,
          processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
          cached: false,
          fallbackApplied: true,
        });
      } else {
        throw new AnalysisGatewayError("All analysis engines failed for this request", 503, false);
      }
    }

    setCachedAnalysis(cacheKey, responsePayload);
    logGateway("info", "analysis-complete", {
      request_id: responsePayload.request_id,
      media_type: responsePayload.media_type,
      mode_requested: responsePayload.mode_requested,
      mode_used: responsePayload.mode_used,
      processing_ms: responsePayload.processing_ms,
      cached: responsePayload.cached,
      fallback_applied: Boolean(responsePayload.fallback_applied),
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    const gatewayError =
      error instanceof AnalysisGatewayError
        ? error
        : new AnalysisGatewayError("Analysis service is currently unavailable", 503, false);

    logGateway("error", "analysis-failed", {
      mode_requested: getConfiguredMode(),
      media_type: mediaType || "unknown",
      processing_ms: Math.max(1, Math.round(performance.now() - startedAt)),
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        message: gatewayError.expose ? gatewayError.message : "Analysis service is currently unavailable",
      },
      { status: gatewayError.status },
    );
  }
}
